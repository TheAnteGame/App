import { autoPick } from "./autopick";
import { autoWager } from "./wager";
import { settlePick } from "./settle";
import { eligibilityFor, type PickHistoryRow } from "./context";
import type { GameLite } from "./types";

/**
 * Job orchestration as pure logic over an injectable data layer (review
 * finding, Aug 12: double-run drift must be provable in tests, not just
 * asserted in comments). `src/lib/jobs.ts` binds this to Supabase; the test
 * suite binds it to an in-memory fake that mimics the Postgres semantics
 * (unique pick per user-week, ledger idempotency keys, atomic settlement).
 */

export type JobWeek = { id: string; week: number };

export type JobPick = {
  id: string;
  user_id: string;
  team_id: number;
  game_id: string;
  wager: number;
  is_ghost: boolean;
};

export type StandingRow = { user_id: string; rank: number; bankroll: number };

export type SnapshotRow = {
  week: number;
  user_id: string;
  rank: number;
  bankroll: number;
  wins: number;
  losses: number;
};

export type JobsData = {
  // lock-week
  /** Weeks in state 'upcoming' with lock_at <= now. */
  dueWeeks(nowIso: string): Promise<JobWeek[]>;
  weekGames(week: number): Promise<GameLite[]>;
  activeUserIds(): Promise<string[]>;
  allTeamIds(): Promise<number[]>;
  weekPickUserIds(week: number): Promise<string[]>;
  userSeasonPicks(userId: string): Promise<PickHistoryRow[]>;
  memberBankroll(userId: string): Promise<number | null>;
  /** Insert a locked AUTO-ANTE pick; false when a submit raced us (unique violation). */
  insertAutoPick(p: {
    userId: string;
    week: number;
    teamId: number;
    gameId: string;
    wager: number;
    nowIso: string;
  }): Promise<boolean>;
  lockSubmittedPicks(week: number, nowIso: string): Promise<void>;
  /** Flip week to revealed — must be a no-op unless state is 'upcoming'. */
  revealWeek(weekId: string, nowIso: string): Promise<void>;

  // settle-games
  revealedWeeks(): Promise<JobWeek[]>;
  lockedPicks(week: number): Promise<JobPick[]>;
  gamesByIds(ids: string[]): Promise<GameLite[]>;
  /** Atomic settlement (settle_pick_atomic): returns its status string. */
  settlePickAtomic(a: {
    pickId: string;
    result: string;
    delta: number;
    reason: string;
  }): Promise<string>;
  userStatus(userId: string): Promise<string | null>;
  /** Picks still in state 'locked' OR 'submitted' for the week (defensive:
   * a stray submitted pick must keep the week open, never settle around it). */
  unsettledPickCount(week: number): Promise<number>;
  standings(): Promise<StandingRow[]>;
  settledResults(uptoWeek: number): Promise<{ user_id: string; result: string | null }[]>;
  upsertSnapshots(rows: SnapshotRow[]): Promise<void>;
  /** Flip week to settled — must be a no-op unless state is 'revealed'. */
  markWeekSettled(weekId: string): Promise<void>;
};

export type LockResult = { weeksLocked: number; autoPicks: number; errors: string[] };
export type SettleResult = {
  settled: number;
  eliminated: number;
  weeksSettled: number;
  errors: string[];
};

/**
 * lock-week (docs/03 Jobs): for every week past its lock_at and still
 * upcoming — lock submitted picks, generate seeded AUTO-ANTE picks for active
 * non-submitters, and fire the reveal. Fully idempotent: state guards make
 * re-runs no-ops, and the auto-pick is deterministic per (user, week).
 */
export async function runLockWeek(
  data: JobsData,
  season: number,
  now: () => Date = () => new Date(),
): Promise<LockResult> {
  const out: LockResult = { weeksLocked: 0, autoPicks: 0, errors: [] };
  const nowIso = now().toISOString();

  for (const week of await data.dueWeeks(nowIso)) {
    const [games, actives, allTeamIds, havePickIds] = await Promise.all([
      data.weekGames(week.week),
      data.activeUserIds(),
      data.allTeamIds(),
      data.weekPickUserIds(week.week),
    ]);
    const havePick = new Set(havePickIds);

    for (const userId of actives) {
      if (havePick.has(userId)) continue;
      // Straggler: the house antes for them.
      const [history, bankroll] = await Promise.all([
        data.userSeasonPicks(userId),
        data.memberBankroll(userId),
      ]);
      const input = eligibilityFor(week.week, games, history);
      const choice = autoPick(userId, season, allTeamIds, input);
      if (!choice) {
        out.errors.push(`no eligible team for user ${userId} week ${week.week} — admin review`);
        continue;
      }
      const wager = autoWager(bankroll ?? 0);
      if (wager <= 0) continue; // zero bankroll shouldn't be active, but never insert a 0 wager
      const inserted = await data.insertAutoPick({
        userId,
        week: week.week,
        teamId: choice.teamId,
        gameId: choice.gameId,
        wager,
        nowIso: now().toISOString(),
      });
      if (inserted) out.autoPicks++;
      // not inserted = a submit raced us; fine either way
    }

    // Lock all submitted picks, reveal the week.
    await data.lockSubmittedPicks(week.week, now().toISOString());
    await data.revealWeek(week.id, now().toISOString());
    out.weeksLocked++;
  }
  return out;
}

/**
 * settle-games (docs/03 Jobs): settle locked picks whose games are OFFICIAL
 * finals (or canceled → void). Settlement is atomic in the DB; re-runs can
 * never double-settle. When a week has no unsettled picks left, snapshot
 * standings and mark it settled.
 */
export async function runSettleGames(data: JobsData): Promise<SettleResult> {
  const out: SettleResult = { settled: 0, eliminated: 0, weeksSettled: 0, errors: [] };

  for (const week of await data.revealedWeeks()) {
    const picks = await data.lockedPicks(week.week);

    // Fetch games by the picks' game_ids (NOT by week number) so a postponed
    // game that ESPN moved to another week can't silently vanish from lookup.
    const gameIds = [...new Set(picks.map((p) => p.game_id))];
    const games = gameIds.length ? await data.gamesByIds(gameIds) : [];
    const gameById = new Map(games.map((g) => [g.id, g]));

    for (const pick of picks) {
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

      const status = await data.settlePickAtomic({
        pickId: pick.id,
        result: outcome.result,
        delta: outcome.delta,
        reason: `Week ${week.week} ${outcome.result}`,
      });
      if (status.startsWith("err:")) {
        out.errors.push(`pick ${pick.id}: ${status}`);
        continue;
      }
      if (status.startsWith("ok:")) {
        out.settled++;
        if (!pick.is_ghost && outcome.delta < 0) {
          // cheap post-check for elimination count (exact status comes from DB)
          if ((await data.userStatus(pick.user_id)) === "eliminated") out.eliminated++;
        }
      }
    }

    // Week fully settled? Snapshot standings and close it out.
    if ((await data.unsettledPickCount(week.week)) === 0) {
      const rows = await data.standings();
      if (rows.length > 0) {
        // W-L from settled non-ghost picks up to this week only.
        const results = await data.settledResults(week.week);
        const wl = new Map<string, { w: number; l: number }>();
        for (const r of results) {
          const rec = wl.get(r.user_id) ?? { w: 0, l: 0 };
          if (r.result === "win") rec.w++;
          if (r.result === "loss") rec.l++;
          wl.set(r.user_id, rec);
        }
        await data.upsertSnapshots(
          rows.map((r) => ({
            week: week.week,
            user_id: r.user_id,
            rank: r.rank,
            bankroll: r.bankroll,
            wins: wl.get(r.user_id)?.w ?? 0,
            losses: wl.get(r.user_id)?.l ?? 0,
          })),
        );
      }
      await data.markWeekSettled(week.id);
      out.weeksSettled++;
    }
  }
  return out;
}
