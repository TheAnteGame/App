import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { autoPick } from "@/lib/engine/autopick";
import { autoWager } from "@/lib/engine/wager";
import { settlePick } from "@/lib/engine/settle";
import { eligibilityFor, toGameLite } from "@/lib/picks";

/**
 * lock-week (docs/03 Jobs): for every week past its lock_at and still
 * upcoming/open — lock submitted picks, generate seeded AUTO-ANTE picks for
 * active non-submitters, and fire the reveal. Fully idempotent: state guards
 * make re-runs no-ops, and the auto-pick is deterministic per (user, week).
 */
export async function lockWeekJob() {
  const db = supabaseAdmin();
  const out = { weeksLocked: 0, autoPicks: 0, errors: [] as string[] };

  const { data: dueWeeks } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .in("state", ["upcoming", "open"])
    .lte("lock_at", new Date().toISOString());

  for (const week of dueWeeks ?? []) {
    const [{ data: games }, { data: actives }, { data: teams }, { data: weekPicks }] =
      await Promise.all([
        db.from("nfl_games").select("*").eq("season", SEASON).eq("week", week.week),
        db.from("users").select("id").eq("status", "active"),
        db.from("nfl_teams").select("id"),
        db
          .from("picks")
          .select("user_id")
          .eq("league_id", BETA_LEAGUE_ID)
          .eq("season", SEASON)
          .eq("week", week.week),
      ]);

    const gameLites = (games ?? []).map(toGameLite);
    const allTeamIds = (teams ?? []).map((t) => t.id);
    const havePick = new Set((weekPicks ?? []).map((p) => p.user_id));

    for (const u of actives ?? []) {
      if (havePick.has(u.id)) continue;
      // Straggler: the house antes for them.
      const [{ data: history }, { data: member }] = await Promise.all([
        db
          .from("picks")
          .select("week, team_id, result, state, is_ghost")
          .eq("league_id", BETA_LEAGUE_ID)
          .eq("user_id", u.id)
          .eq("season", SEASON),
        db
          .from("league_members")
          .select("bankroll")
          .eq("league_id", BETA_LEAGUE_ID)
          .eq("user_id", u.id)
          .maybeSingle(),
      ]);
      const input = eligibilityFor(week.week, gameLites, history ?? []);
      const choice = autoPick(u.id, SEASON, allTeamIds, input);
      if (!choice) {
        out.errors.push(`no eligible team for user ${u.id} week ${week.week} — admin review`);
        continue;
      }
      const wager = autoWager(member?.bankroll ?? 0);
      if (wager <= 0) continue; // zero bankroll shouldn't be active, but never insert a 0 wager
      const { error } = await db.from("picks").insert({
        league_id: BETA_LEAGUE_ID,
        user_id: u.id,
        season: SEASON,
        week: week.week,
        team_id: choice.teamId,
        game_id: choice.gameId,
        wager,
        pick_type: "auto",
        state: "locked",
        locked_at: new Date().toISOString(),
      });
      if (!error) out.autoPicks++;
      // unique-violation = a submit raced us; fine either way
    }

    // Lock all submitted picks, reveal the week.
    await db
      .from("picks")
      .update({ state: "locked", locked_at: new Date().toISOString() })
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("week", week.week)
      .eq("state", "submitted");
    await db
      .from("weeks")
      .update({ state: "revealed", revealed_at: new Date().toISOString() })
      .eq("id", week.id)
      .in("state", ["upcoming", "open"]);
    out.weeksLocked++;
  }
  return out;
}

/**
 * settle-games (docs/03 Jobs): settle locked picks whose games are OFFICIAL
 * finals (or canceled → void). Ledger rows carry idempotency keys; the cached
 * bankroll only moves when a ledger row is actually inserted, so re-runs can
 * never double-settle. Eliminations flip status; when a week has no unsettled
 * picks left, snapshot standings and mark it settled.
 */
export async function settleGamesJob() {
  const db = supabaseAdmin();
  const out = { settled: 0, eliminated: 0, weeksSettled: 0, errors: [] as string[] };

  const { data: revealedWeeks } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("state", "revealed");

  for (const week of revealedWeeks ?? []) {
    const { data: picks } = await db
      .from("picks")
      .select("*")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("week", week.week)
      .eq("state", "locked");

    // Fetch games by the picks' game_ids (NOT by week number) so a postponed
    // game that ESPN moved to another week can't silently vanish from lookup.
    const gameIds = [...new Set((picks ?? []).map((p) => p.game_id))];
    const { data: games } = gameIds.length
      ? await db.from("nfl_games").select("*").in("id", gameIds)
      : { data: [] };
    const gameById = new Map((games ?? []).map((g) => [g.id, toGameLite(g)]));

    for (const pick of picks ?? []) {
      const game = gameById.get(pick.game_id);
      if (!game) {
        out.errors.push(`pick ${pick.id}: game ${pick.game_id} missing — admin review`);
        continue;
      }
      if (game.week !== week.week) {
        out.errors.push(
          `pick ${pick.id}: game moved from week ${week.week} to ${game.week} — admin review (docs/02 §6)`,
        );
        continue;
      }
      const outcome = settlePick(pick.team_id, pick.wager, game);
      if (!outcome) continue; // awaiting official result — never guess

      // Atomic settlement: ledger + bankroll + elimination + ghosting of
      // future picks happen in ONE Postgres transaction (settle_pick_atomic,
      // migration 0003). A pick can never be marked settled without its
      // ledger row, and errors leave it locked for the next run / admin.
      const { data: rpcResult, error: rpcErr } = await db.rpc("settle_pick_atomic", {
        p_pick_id: pick.id,
        p_result: outcome.result,
        p_delta: outcome.delta,
        p_reason: `Week ${week.week} ${outcome.result}`,
      });
      if (rpcErr) {
        out.errors.push(`pick ${pick.id}: rpc failed: ${rpcErr.message}`);
        continue;
      }
      const status = String(rpcResult ?? "");
      if (status.startsWith("err:")) {
        out.errors.push(`pick ${pick.id}: ${status}`);
        continue;
      }
      if (status.startsWith("ok:")) {
        out.settled++;
        if (!pick.is_ghost && pick.wager >= 0 && outcome.delta < 0) {
          // cheap post-check for elimination count (exact status comes from DB)
          const { data: u } = await db.from("users").select("status").eq("id", pick.user_id).single();
          if (u?.status === "eliminated") out.eliminated++;
        }
      }
    }

    // Week fully settled? Snapshot standings and close it out.
    const { count } = await db
      .from("picks")
      .select("id", { count: "exact", head: true })
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("week", week.week)
      .eq("state", "locked");
    if ((count ?? 0) === 0) {
      const { data: rows } = await db
        .from("current_standings")
        .select("*")
        .eq("league_id", BETA_LEAGUE_ID);
      if (rows && rows.length > 0) {
        // W-L from settled non-ghost picks
        const { data: results } = await db
          .from("picks")
          .select("user_id, result")
          .eq("league_id", BETA_LEAGUE_ID)
          .eq("season", SEASON)
          .eq("is_ghost", false)
          .eq("state", "settled")
          .lte("week", week.week); // snapshot W-L must not include later weeks
        const wl = new Map<string, { w: number; l: number }>();
        for (const r of results ?? []) {
          const rec = wl.get(r.user_id) ?? { w: 0, l: 0 };
          if (r.result === "win") rec.w++;
          if (r.result === "loss") rec.l++;
          wl.set(r.user_id, rec);
        }
        await db.from("standings_snapshots").upsert(
          rows.map((r) => ({
            league_id: BETA_LEAGUE_ID,
            season: SEASON,
            week: week.week,
            user_id: r.user_id,
            rank: r.rank,
            bankroll: r.bankroll,
            wins: wl.get(r.user_id)?.w ?? 0,
            losses: wl.get(r.user_id)?.l ?? 0,
          })),
          { onConflict: "league_id,season,week,user_id" },
        );
      }
      await db.from("weeks").update({ state: "settled" }).eq("id", week.id).eq("state", "revealed");
      out.weeksSettled++;
    }
  }
  return out;
}
