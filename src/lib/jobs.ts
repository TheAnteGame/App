import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { toGameLite } from "@/lib/engine/context";
import {
  runLockWeek,
  runSettleGames,
  type JobsData,
  type SnapshotRow,
} from "@/lib/engine/jobs-core";

/**
 * Supabase binding for the job core (`src/lib/engine/jobs-core.ts`), which
 * holds the actual lock/settle orchestration and is covered by double-run
 * drift tests against an in-memory data layer.
 */
function supabaseJobsData(): JobsData {
  const db = supabaseAdmin();
  return {
    async dueWeeks(nowIso) {
      const { data } = await db
        .from("weeks")
        .select("id, week")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("state", "upcoming")
        .lte("lock_at", nowIso);
      return data ?? [];
    },
    async weekGames(week) {
      const { data } = await db
        .from("nfl_games")
        .select("*")
        .eq("season", SEASON)
        .eq("week", week);
      return (data ?? []).map(toGameLite);
    },
    async activeUserIds() {
      const { data } = await db.from("users").select("id").eq("status", "active");
      return (data ?? []).map((u) => u.id);
    },
    async allTeamIds() {
      const { data } = await db.from("nfl_teams").select("id");
      return (data ?? []).map((t) => t.id);
    },
    async weekPickUserIds(week) {
      const { data } = await db
        .from("picks")
        .select("user_id")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", week);
      return (data ?? []).map((p) => p.user_id);
    },
    async userSeasonPicks(userId) {
      const { data } = await db
        .from("picks")
        .select("week, team_id, result, state, is_ghost")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("user_id", userId)
        .eq("season", SEASON);
      return data ?? [];
    },
    async memberBankroll(userId) {
      const { data } = await db
        .from("league_members")
        .select("bankroll")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("user_id", userId)
        .maybeSingle();
      return data?.bankroll ?? null;
    },
    async insertAutoPick(p) {
      const { error } = await db.from("picks").insert({
        league_id: BETA_LEAGUE_ID,
        user_id: p.userId,
        season: SEASON,
        week: p.week,
        team_id: p.teamId,
        game_id: p.gameId,
        wager: p.wager,
        pick_type: "auto",
        state: "locked",
        locked_at: p.nowIso,
      });
      return !error; // unique violation = a submit raced us
    },
    async lockSubmittedPicks(week, nowIso) {
      await db
        .from("picks")
        .update({ state: "locked", locked_at: nowIso })
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", week)
        .eq("state", "submitted");
    },
    async revealWeek(weekId, nowIso) {
      await db
        .from("weeks")
        .update({ state: "revealed", revealed_at: nowIso })
        .eq("id", weekId)
        .eq("state", "upcoming");
    },
    async revealedWeeks() {
      const { data } = await db
        .from("weeks")
        .select("id, week")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("state", "revealed");
      return data ?? [];
    },
    async lockedPicks(week) {
      const { data } = await db
        .from("picks")
        .select("id, user_id, team_id, game_id, wager, is_ghost")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", week)
        .eq("state", "locked");
      return data ?? [];
    },
    async gamesByIds(ids) {
      const { data } = await db.from("nfl_games").select("*").in("id", ids);
      return (data ?? []).map(toGameLite);
    },
    async settlePickAtomic(a) {
      const { data, error } = await db.rpc("settle_pick_atomic", {
        p_pick_id: a.pickId,
        p_result: a.result,
        p_delta: a.delta,
        p_reason: a.reason,
      });
      if (error) return `err:rpc failed: ${error.message}`;
      return String(data ?? "");
    },
    async userStatus(userId) {
      const { data } = await db.from("users").select("status").eq("id", userId).maybeSingle();
      return data?.status ?? null;
    },
    async unsettledPickCount(week) {
      const { count } = await db
        .from("picks")
        .select("id", { count: "exact", head: true })
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", week)
        .in("state", ["locked", "submitted"]);
      return count ?? 0;
    },
    async standings() {
      const { data } = await db
        .from("current_standings")
        .select("*")
        .eq("league_id", BETA_LEAGUE_ID);
      return data ?? [];
    },
    async settledResults(uptoWeek) {
      const { data } = await db
        .from("picks")
        .select("user_id, result")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("is_ghost", false)
        .eq("state", "settled")
        .lte("week", uptoWeek); // snapshot W-L must not include later weeks
      return data ?? [];
    },
    async upsertSnapshots(rows: SnapshotRow[]) {
      await db.from("standings_snapshots").upsert(
        rows.map((r) => ({ league_id: BETA_LEAGUE_ID, season: SEASON, ...r })),
        { onConflict: "league_id,season,week,user_id" },
      );
    },
    async markWeekSettled(weekId) {
      await db.from("weeks").update({ state: "settled" }).eq("id", weekId).eq("state", "revealed");
    },
  };
}

export async function lockWeekJob() {
  return runLockWeek(supabaseJobsData(), SEASON);
}

export async function settleGamesJob() {
  return runSettleGames(supabaseJobsData());
}
