import { describe, it, expect } from "vitest";
import {
  runLockWeek,
  runSettleGames,
  type JobsData,
  type SnapshotRow,
} from "./jobs-core";
import type { GameLite } from "./types";

/**
 * Double-run drift tests (review finding, Aug 12): the job layer must be
 * provably idempotent, including crash-replay (a re-run after a partial
 * commit). The fake mimics the Postgres semantics the real layer relies on:
 * unique pick per user-week, ledger idempotency keys, atomic settlement with
 * elimination + future-pick ghosting, state-guarded week transitions.
 */

type FakePick = {
  id: string;
  user_id: string;
  week: number;
  team_id: number;
  game_id: string;
  wager: number;
  pick_type: string;
  is_ghost: boolean;
  state: "submitted" | "locked" | "settled";
  result: string | null;
};

class FakeDb implements JobsData {
  weeks: { id: string; week: number; state: string; lock_at: string }[] = [];
  games: GameLite[] = [];
  users: { id: string; status: string }[] = [];
  teams: number[] = [];
  picks: FakePick[] = [];
  bankrolls = new Map<string, number>();
  ledger = new Map<string, { user_id: string; amount: number }>(); // key = idempotency
  snapshots = new Map<string, SnapshotRow>();
  private seq = 0;

  addPick(p: Omit<FakePick, "id" | "result"> & { result?: string | null }): FakePick {
    if (this.picks.some((x) => x.user_id === p.user_id && x.week === p.week)) {
      throw new Error("unique violation: one pick per user-week");
    }
    const row: FakePick = { id: `pick-${++this.seq}`, result: null, ...p };
    this.picks.push(row);
    return row;
  }

  // ---- JobsData ----
  async dueWeeks(nowIso: string) {
    return this.weeks.filter((w) => w.state === "upcoming" && w.lock_at <= nowIso);
  }
  async weekGames(week: number) {
    return this.games.filter((g) => g.week === week);
  }
  async activeUserIds() {
    return this.users.filter((u) => u.status === "active").map((u) => u.id);
  }
  async allTeamIds() {
    return this.teams;
  }
  async weekPickUserIds(week: number) {
    return this.picks.filter((p) => p.week === week).map((p) => p.user_id);
  }
  async userSeasonPicks(userId: string) {
    return this.picks
      .filter((p) => p.user_id === userId)
      .map((p) => ({
        week: p.week,
        team_id: p.team_id,
        result: p.result,
        state: p.state,
        is_ghost: p.is_ghost,
      }));
  }
  async memberBankroll(userId: string) {
    return this.bankrolls.get(userId) ?? null;
  }
  async insertAutoPick(p: {
    userId: string;
    week: number;
    teamId: number;
    gameId: string;
    wager: number;
  }) {
    try {
      this.addPick({
        user_id: p.userId,
        week: p.week,
        team_id: p.teamId,
        game_id: p.gameId,
        wager: p.wager,
        pick_type: "auto",
        is_ghost: false,
        state: "locked",
      });
      return true;
    } catch {
      return false; // unique violation, like Postgres
    }
  }
  async lockSubmittedPicks(week: number) {
    for (const p of this.picks) {
      if (p.week === week && p.state === "submitted") p.state = "locked";
    }
  }
  async revealWeek(weekId: string) {
    const w = this.weeks.find((x) => x.id === weekId);
    if (w && w.state === "upcoming") w.state = "revealed";
  }
  async revealedWeeks() {
    return this.weeks.filter((w) => w.state === "revealed");
  }
  async lockedPicks(week: number) {
    return this.picks.filter((p) => p.week === week && p.state === "locked");
  }
  async gamesByIds(ids: string[]) {
    return this.games.filter((g) => ids.includes(g.id));
  }
  async settlePickAtomic(a: { pickId: string; result: string; delta: number; reason: string }) {
    // Mirrors settle_pick_atomic (migration 0003) semantics.
    const pick = this.picks.find((p) => p.id === a.pickId);
    if (!pick || pick.state !== "locked") return "skip:not_locked";
    if (pick.is_ghost) {
      pick.state = "settled";
      pick.result = a.result;
      return "ok:ghost";
    }
    const key = `settle:${pick.id}`;
    let wrote = false;
    if (!this.ledger.has(key)) {
      this.ledger.set(key, { user_id: pick.user_id, amount: a.delta });
      wrote = true;
      const after = (this.bankrolls.get(pick.user_id) ?? 0) + a.delta;
      this.bankrolls.set(pick.user_id, after);
      if (after <= 0) {
        const u = this.users.find((x) => x.id === pick.user_id);
        if (u && u.status === "active") u.status = "eliminated";
        for (const fp of this.picks) {
          if (fp.user_id === pick.user_id && fp.week > pick.week && fp.state !== "settled") {
            fp.is_ghost = true;
          }
        }
      }
    }
    pick.state = "settled";
    pick.result = a.result;
    return wrote ? "ok:settled" : "ok:already_ledgered";
  }
  async userStatus(userId: string) {
    return this.users.find((u) => u.id === userId)?.status ?? null;
  }
  async unsettledPickCount(week: number) {
    return this.picks.filter(
      (p) => p.week === week && (p.state === "locked" || p.state === "submitted"),
    ).length;
  }
  async standings() {
    const rows = [...this.bankrolls.entries()]
      .filter(([id]) => {
        const s = this.users.find((u) => u.id === id)?.status;
        return s === "active" || s === "eliminated";
      })
      .sort((a, b) => b[1] - a[1]);
    return rows.map(([user_id, bankroll], i) => ({ user_id, bankroll, rank: i + 1 }));
  }
  async settledResults(uptoWeek: number) {
    return this.picks
      .filter((p) => !p.is_ghost && p.state === "settled" && p.week <= uptoWeek)
      .map((p) => ({ user_id: p.user_id, result: p.result }));
  }
  async upsertSnapshots(rows: SnapshotRow[]) {
    for (const r of rows) this.snapshots.set(`${r.week}:${r.user_id}`, r);
  }
  async markWeekSettled(weekId: string) {
    const w = this.weeks.find((x) => x.id === weekId);
    if (w && w.state === "revealed") w.state = "settled";
  }

  snapshotState() {
    return JSON.stringify({
      weeks: this.weeks,
      picks: this.picks,
      bankrolls: [...this.bankrolls.entries()],
      ledger: [...this.ledger.entries()],
      users: this.users,
      snapshots: [...this.snapshots.entries()],
    });
  }
}

const SEASON = 2026;
const NOW = () => new Date("2026-09-10T00:00:00Z");

function game(id: string, week: number, home: number, away: number, opts?: Partial<GameLite>): GameLite {
  return {
    id,
    week,
    homeTeamId: home,
    awayTeamId: away,
    kickoffAt: new Date("2026-09-09T20:20:00Z"),
    status: "scheduled",
    winnerTeamId: null,
    ...opts,
  };
}

/** League of 3: alice submitted, bob is a straggler, carol submitted all-in. */
function buildLockFixture() {
  const db = new FakeDb();
  db.weeks = [{ id: "w1", week: 1, state: "upcoming", lock_at: "2026-09-09T19:00:00Z" }];
  db.teams = [1, 2, 3, 4];
  db.games = [game("g1", 1, 1, 2), game("g2", 1, 3, 4)];
  db.users = [
    { id: "alice", status: "active" },
    { id: "bob", status: "active" },
    { id: "carol", status: "active" },
  ];
  db.bankrolls.set("alice", 1000);
  db.bankrolls.set("bob", 1000);
  db.bankrolls.set("carol", 1000);
  db.addPick({
    user_id: "alice", week: 1, team_id: 1, game_id: "g1", wager: 250,
    pick_type: "manual", is_ghost: false, state: "submitted",
  });
  db.addPick({
    user_id: "carol", week: 1, team_id: 3, game_id: "g2", wager: 1000,
    pick_type: "manual", is_ghost: false, state: "submitted",
  });
  return db;
}

describe("runLockWeek", () => {
  it("locks submitted picks, auto-antes stragglers, reveals the week", async () => {
    const db = buildLockFixture();
    const r = await runLockWeek(db, SEASON, NOW);
    expect(r.errors).toEqual([]);
    expect(r.weeksLocked).toBe(1);
    expect(r.autoPicks).toBe(1);
    expect(db.weeks[0].state).toBe("revealed");
    expect(db.picks.every((p) => p.state === "locked")).toBe(true);
    const bobPick = db.picks.find((p) => p.user_id === "bob")!;
    expect(bobPick.pick_type).toBe("auto");
    expect(bobPick.wager).toBe(100);
  });

  it("second run is a complete no-op (state guard)", async () => {
    const db = buildLockFixture();
    await runLockWeek(db, SEASON, NOW);
    const before = db.snapshotState();
    const r2 = await runLockWeek(db, SEASON, NOW);
    expect(r2).toEqual({ weeksLocked: 0, autoPicks: 0, errors: [] });
    expect(db.snapshotState()).toBe(before);
  });

  it("crash-replay drifts nothing: re-running with the week forced back to upcoming duplicates no picks and keeps the same auto team", async () => {
    const db = buildLockFixture();
    await runLockWeek(db, SEASON, NOW);
    const firstAuto = db.picks.find((p) => p.user_id === "bob")!;
    // Simulate a crash between locking picks and committing the reveal.
    db.weeks[0].state = "upcoming";
    const r2 = await runLockWeek(db, SEASON, NOW);
    expect(r2.autoPicks).toBe(0); // unique constraint absorbed the replay
    expect(db.picks.filter((p) => p.user_id === "bob")).toHaveLength(1);
    expect(db.picks.find((p) => p.user_id === "bob")!.team_id).toBe(firstAuto.team_id);
    expect(db.weeks[0].state).toBe("revealed");
  });

  it("auto-pick is deterministic across independent replays from the same start state", async () => {
    const a = buildLockFixture();
    const b = buildLockFixture();
    await runLockWeek(a, SEASON, NOW);
    await runLockWeek(b, SEASON, NOW);
    expect(a.picks.find((p) => p.user_id === "bob")!.team_id).toBe(
      b.picks.find((p) => p.user_id === "bob")!.team_id,
    );
  });
});

function buildSettleFixture() {
  const db = buildLockFixture();
  return runLockWeek(db, SEASON, NOW).then(() => db);
}

describe("runSettleGames", () => {
  it("settles finals (win/loss), leaves in-progress picks, closes the week only when all settle", async () => {
    const db = await buildSettleFixture();
    // Bob's seeded auto-pick lands on g1 or g2 — compute expectations from it.
    const bobPick = db.picks.find((p) => p.user_id === "bob")!;
    const bobOnG1 = bobPick.game_id === "g1";
    // g1 final (team 1 wins → alice wins); g2 still in progress.
    db.games[0] = { ...db.games[0], status: "final", winnerTeamId: 1 };
    db.games[1] = { ...db.games[1], status: "in_progress" };
    const r1 = await runSettleGames(db);
    expect(r1.errors).toEqual([]);
    expect(r1.settled).toBe(1 + (bobOnG1 ? 1 : 0));
    expect(r1.weeksSettled).toBe(0); // carol's g2 pick still open
    expect(db.bankrolls.get("alice")).toBe(1250);
    expect(db.weeks[0].state).toBe("revealed");

    // g2 goes final: team 4 wins → carol (all-in on 3) busts.
    db.games[1] = { ...db.games[1], status: "final", winnerTeamId: 4 };
    const r2 = await runSettleGames(db);
    expect(r2.errors).toEqual([]);
    expect(db.weeks[0].state).toBe("settled");
    expect(db.bankrolls.get("carol")).toBe(0);
    expect(db.users.find((u) => u.id === "carol")!.status).toBe("eliminated");
    expect(r2.eliminated).toBe(1);
    // Bob's stack reconciles with his game's outcome.
    const bobWinner = (bobOnG1 ? db.games[0] : db.games[1]).winnerTeamId;
    expect(db.bankrolls.get("bob")).toBe(1000 + (bobWinner === bobPick.team_id ? 100 : -100));
    expect(db.snapshots.size).toBe(3); // standings snapshot for all three
  });

  it("double-run drifts nothing: ledger, bankrolls, statuses, snapshots all stable", async () => {
    const db = await buildSettleFixture();
    db.games[0] = { ...db.games[0], status: "final", winnerTeamId: 1 };
    db.games[1] = { ...db.games[1], status: "final", winnerTeamId: 4 };
    await runSettleGames(db);
    const before = db.snapshotState();
    const r2 = await runSettleGames(db);
    expect(r2).toEqual({ settled: 0, eliminated: 0, weeksSettled: 0, errors: [] });
    expect(db.snapshotState()).toBe(before);
  });

  it("crash-replay drifts nothing: week forced back to revealed re-settles no points", async () => {
    const db = await buildSettleFixture();
    db.games[0] = { ...db.games[0], status: "final", winnerTeamId: 1 };
    db.games[1] = { ...db.games[1], status: "final", winnerTeamId: 4 };
    await runSettleGames(db);
    const ledgerBefore = [...db.ledger.entries()];
    const bankrollsBefore = [...db.bankrolls.entries()];
    // Simulate a crash before the week flipped to settled.
    db.weeks[0].state = "revealed";
    const r2 = await runSettleGames(db);
    expect(r2.errors).toEqual([]);
    expect([...db.ledger.entries()]).toEqual(ledgerBefore);
    expect([...db.bankrolls.entries()]).toEqual(bankrollsBefore);
    expect(db.weeks[0].state).toBe("settled");
  });

  it("a stray submitted pick keeps the week open instead of settling around it", async () => {
    const db = await buildSettleFixture();
    db.games[0] = { ...db.games[0], status: "final", winnerTeamId: 1 };
    db.games[1] = { ...db.games[1], status: "final", winnerTeamId: 4 };
    // Bug-state simulation: a pick that never got locked.
    db.picks.find((p) => p.user_id === "bob")!.state = "submitted";
    const r = await runSettleGames(db);
    expect(r.weeksSettled).toBe(0);
    expect(db.weeks[0].state).toBe("revealed");
  });

  it("push on an official tie moves no points but settles the pick", async () => {
    const db = await buildSettleFixture();
    db.games[0] = { ...db.games[0], status: "final", winnerTeamId: null }; // tie
    const r = await runSettleGames(db);
    expect(r.settled).toBeGreaterThanOrEqual(1);
    expect(db.bankrolls.get("alice")).toBe(1000);
    expect(db.picks.find((p) => p.user_id === "alice")!.result).toBe("push");
    // Push on bob too if his auto-pick landed on the tied game.
    const bobPick = db.picks.find((p) => p.user_id === "bob")!;
    if (bobPick.game_id === "g1") {
      expect(bobPick.result).toBe("push");
      expect(db.bankrolls.get("bob")).toBe(1000);
    }
  });

  it("elimination ghosts the player's unsettled future picks", async () => {
    const db = await buildSettleFixture();
    db.weeks.push({ id: "w2", week: 2, state: "upcoming", lock_at: "2026-09-16T19:00:00Z" });
    db.addPick({
      user_id: "carol", week: 2, team_id: 2, game_id: "g3", wager: 100,
      pick_type: "manual", is_ghost: false, state: "submitted",
    });
    db.games[1] = { ...db.games[1], status: "final", winnerTeamId: 4 }; // carol busts
    await runSettleGames(db);
    expect(db.picks.find((p) => p.user_id === "carol" && p.week === 2)!.is_ghost).toBe(true);
  });
});
