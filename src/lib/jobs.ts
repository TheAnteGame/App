import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { autoPick } from "@/lib/engine/autopick";
import { autoWager } from "@/lib/engine/wager";
import { settlePick, isEliminated, ledgerKeys } from "@/lib/engine/settle";
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
    const [{ data: picks }, { data: games }] = await Promise.all([
      db
        .from("picks")
        .select("*")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", week.week)
        .eq("state", "locked"),
      db.from("nfl_games").select("*").eq("season", SEASON).eq("week", week.week),
    ]);
    const gameById = new Map((games ?? []).map((g) => [g.id, toGameLite(g)]));

    for (const pick of picks ?? []) {
      const game = gameById.get(pick.game_id);
      if (!game) continue;
      const outcome = settlePick(pick.team_id, pick.wager, game);
      if (!outcome) continue; // awaiting official result — never guess

      if (pick.is_ghost) {
        await db
          .from("picks")
          .update({ state: "settled", result: outcome.result, settled_at: new Date().toISOString() })
          .eq("id", pick.id)
          .eq("state", "locked");
        out.settled++;
        continue;
      }

      const { data: member } = await db
        .from("league_members")
        .select("bankroll")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("user_id", pick.user_id)
        .maybeSingle();
      if (member == null) {
        out.errors.push(`no membership for user ${pick.user_id}`);
        continue;
      }
      const before = member.bankroll;
      const after = before + outcome.delta;

      // Idempotent ledger write — the ONLY gate for moving cached bankroll.
      const { data: inserted } = await db
        .from("ledger")
        .upsert(
          {
            league_id: BETA_LEAGUE_ID,
            user_id: pick.user_id,
            pick_id: pick.id,
            entry_type:
              outcome.result === "win"
                ? "wager_win"
                : outcome.result === "loss"
                  ? "wager_loss"
                  : "push",
            amount: outcome.delta,
            bankroll_before: before,
            bankroll_after: after,
            idempotency_key: ledgerKeys.settlement(pick.id),
            reason: `Week ${week.week} ${outcome.result}`,
          },
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        )
        .select();

      if (inserted && inserted.length > 0) {
        await db
          .from("league_members")
          .update({ bankroll: after })
          .eq("league_id", BETA_LEAGUE_ID)
          .eq("user_id", pick.user_id);
        if (isEliminated(after)) {
          await db.from("users").update({ status: "eliminated" }).eq("id", pick.user_id);
          out.eliminated++;
        }
      }

      await db
        .from("picks")
        .update({ state: "settled", result: outcome.result, settled_at: new Date().toISOString() })
        .eq("id", pick.id)
        .eq("state", "locked");
      out.settled++;
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
          .eq("state", "settled");
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
