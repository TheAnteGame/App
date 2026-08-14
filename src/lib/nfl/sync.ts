import { supabaseAdmin } from "@/lib/supabase/server";
import { fetchWeek, type NormalizedGame } from "./espn";
import { computeLock } from "./lock";

/**
 * sync-schedule job core (docs/03 Jobs). Idempotent: upserts nfl_games keyed by
 * espn_event_id (kickoff changes update rows, never IDs), then recomputes each
 * week's lock_at unless the admin has overridden it or the week is already locked.
 */

export type SyncResult = {
  season: number;
  weeks: number[];
  gamesUpserted: number;
  weeksTouched: number;
  errors: string[];
};

export async function syncSchedule(
  season: number,
  weeks: number[],
  leagueId: string,
): Promise<SyncResult> {
  const db = supabaseAdmin();
  const result: SyncResult = {
    season,
    weeks,
    gamesUpserted: 0,
    weeksTouched: 0,
    errors: [],
  };

  const { data: teams, error: teamsErr } = await db
    .from("nfl_teams")
    .select("id, abbr");
  if (teamsErr || !teams?.length) {
    result.errors.push(`teams lookup failed: ${teamsErr?.message ?? "empty"}`);
    return result;
  }
  const teamByAbbr = new Map(teams.map((t) => [t.abbr as string, t.id as number]));

  for (const week of weeks) {
    let games: NormalizedGame[];
    try {
      games = await fetchWeek(season, week);
    } catch (e) {
      result.errors.push(String(e));
      continue; // one bad week never blocks the rest
    }
    if (games.length === 0) continue;

    const rows = [];
    for (const g of games) {
      const home = teamByAbbr.get(g.home_abbr);
      const away = teamByAbbr.get(g.away_abbr);
      if (!home || !away) {
        result.errors.push(
          `unknown team abbr ${g.home_abbr}/${g.away_abbr} (event ${g.espn_event_id})`,
        );
        continue;
      }
      rows.push({
        espn_event_id: g.espn_event_id,
        season: g.season,
        week: g.week,
        home_team_id: home,
        away_team_id: away,
        kickoff_at: g.kickoff_at,
        status: g.status,
        home_score: g.home_score,
        away_score: g.away_score,
        winner_team_id: g.winner_abbr ? teamByAbbr.get(g.winner_abbr) ?? null : null,
        updated_at: new Date().toISOString(),
      });
    }

    const { error: upsertErr, count } = await db
      .from("nfl_games")
      .upsert(rows, { onConflict: "espn_event_id", count: "exact" });
    if (upsertErr) {
      result.errors.push(`week ${week} upsert failed: ${upsertErr.message}`);
      continue;
    }
    result.gamesUpserted += count ?? rows.length;

    // Recompute the week's lock unless admin-overridden or already past open.
    const { lockAt, lockSource } = computeLock(
      rows.map((r) => new Date(r.kickoff_at)),
    );
    const { data: existing } = await db
      .from("weeks")
      .select("id, lock_source, state")
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq("week", week)
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from("weeks").insert({
        league_id: leagueId,
        season,
        week,
        lock_at: lockAt.toISOString(),
        lock_source: lockSource,
        state: "upcoming",
      });
      if (error) result.errors.push(`week ${week} insert failed: ${error.message}`);
      else result.weeksTouched++;
    } else if (
      existing.lock_source !== "admin_override" &&
      ["upcoming", "open"].includes(existing.state as string)
    ) {
      const { error } = await db
        .from("weeks")
        .update({ lock_at: lockAt.toISOString(), lock_source: lockSource })
        .eq("id", existing.id);
      if (error) result.errors.push(`week ${week} update failed: ${error.message}`);
      else result.weeksTouched++;
    }
  }

  return result;
}
