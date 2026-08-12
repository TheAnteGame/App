import { describe, it, expect } from "vitest";
import { evaluateTeam, eligibleTeams, type EligibilityInput } from "./eligibility";
import { validateWager, autoWager } from "./wager";
import { autoPick } from "./autopick";
import { settlePick, isEliminated, ledgerKeys } from "./settle";
import type { GameLite } from "./types";

const g = (
  id: string,
  home: number,
  away: number,
  status: GameLite["status"] = "scheduled",
  winner: number | null = null,
): GameLite => ({
  id,
  week: 5,
  homeTeamId: home,
  awayTeamId: away,
  kickoffAt: new Date("2026-10-11T17:00:00Z"),
  status,
  winnerTeamId: winner,
});

const baseInput = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  week: 5,
  games: [g("g1", 1, 2), g("g2", 3, 4)],
  usage: new Map(),
  priorWeekTeamId: null,
  ...over,
});

describe("eligibility (docs/02 §3)", () => {
  it("team on bye is ineligible", () => {
    expect(evaluateTeam(9, baseInput()).reason).toBe("bye");
  });
  it("canceled game does not count as playing", () => {
    const input = baseInput({ games: [g("g1", 1, 2, "canceled"), g("g2", 3, 4)] });
    expect(evaluateTeam(1, input).reason).toBe("bye");
  });
  it("used twice is ineligible; once is fine", () => {
    const input = baseInput({ usage: new Map([[1, 2], [2, 1]]) });
    expect(evaluateTeam(1, input).reason).toBe("used_max");
    expect(evaluateTeam(2, input).eligible).toBe(true);
  });
  it("prior week's team is ineligible (no consecutive)", () => {
    expect(evaluateTeam(3, baseInput({ priorWeekTeamId: 3 })).reason).toBe("used_last_week");
  });
  it("eligible team carries its gameId", () => {
    const t = evaluateTeam(4, baseInput());
    expect(t.eligible).toBe(true);
    expect(t.gameId).toBe("g2");
  });
});

describe("wager validation (docs/02 §2, §8)", () => {
  const reg = { min: 100, max: 1000, isOvertime: false };
  it("accepts bounds and rejects outside them", () => {
    expect(validateWager(100, 1000, reg).ok).toBe(true);
    expect(validateWager(1000, 1000, reg).ok).toBe(true);
    expect(validateWager(99, 1000, reg).ok).toBe(false);
    expect(validateWager(1001, 5000, reg).ok).toBe(false);
  });
  it("rejects non-integers and over-bankroll", () => {
    expect(validateWager(150.5, 1000, reg).ok).toBe(false);
    expect(validateWager(500, 400, reg).ok).toBe(false);
  });
  it("sub-100 bankroll forces exact all-in", () => {
    expect(validateWager(60, 60, reg).ok).toBe(true);
    expect(validateWager(50, 60, reg).ok).toBe(false);
    expect(validateWager(100, 60, reg).ok).toBe(false);
  });
  it("zero bankroll can never wager", () => {
    expect(validateWager(0, 0, reg).ok).toBe(false);
  });
  it("overtime floor is 1, ceiling is FULL bankroll (docs/02 §8 — no 1000 cap)", () => {
    const ot = { min: 100, max: 1000, isOvertime: true };
    expect(validateWager(1, 800, ot).ok).toBe(true);
    expect(validateWager(0, 800, ot).ok).toBe(false);
    expect(validateWager(801, 800, ot).ok).toBe(false);
    expect(validateWager(1500, 2400, ot).ok).toBe(true); // champion-tie stacks exceed 1000
    expect(validateWager(2400, 2400, ot).ok).toBe(true);
    expect(validateWager(2401, 2400, ot).ok).toBe(false);
  });
  it("auto-wager is 100 or the whole sub-100 stack", () => {
    expect(autoWager(1000)).toBe(100);
    expect(autoWager(80)).toBe(80);
  });
});

describe("auto-pick (docs/02 §5) — seeded & idempotent", () => {
  const teams = [1, 2, 3, 4];
  it("same inputs → same pick, every run", () => {
    const a = autoPick("user-1", 2026, teams, baseInput());
    for (let i = 0; i < 25; i++) {
      expect(autoPick("user-1", 2026, teams, baseInput())).toEqual(a);
    }
  });
  it("only ever picks eligible teams", () => {
    const input = baseInput({ usage: new Map([[1, 2], [2, 2], [3, 2]]) });
    const p = autoPick("user-2", 2026, teams, input);
    expect(p?.teamId).toBe(4);
  });
  it("different users can differ; result is from the pool", () => {
    const picks = new Set(
      ["a", "b", "c", "d", "e", "f"].map(
        (u) => autoPick(u, 2026, teams, baseInput())!.teamId,
      ),
    );
    for (const t of picks) expect(teams).toContain(t);
  });
  it("returns null when nothing is eligible", () => {
    const input = baseInput({ usage: new Map([[1, 2], [2, 2], [3, 2], [4, 2]]) });
    expect(autoPick("user-3", 2026, teams, input)).toBeNull();
  });
});

describe("settlement (docs/02 §6–7)", () => {
  it("win adds the wager, loss subtracts it", () => {
    expect(settlePick(1, 300, g("g", 1, 2, "final", 1))).toEqual({
      result: "win", delta: 300, usageCounts: true,
    });
    expect(settlePick(2, 300, g("g", 1, 2, "final", 1))).toEqual({
      result: "loss", delta: -300, usageCounts: true,
    });
  });
  it("tie (final, no winner) is a push that still consumes the team use", () => {
    expect(settlePick(1, 300, g("g", 1, 2, "final", null))).toEqual({
      result: "push", delta: 0, usageCounts: true,
    });
  });
  it("canceled is a void push; wager restored", () => {
    expect(settlePick(1, 300, g("g", 1, 2, "canceled"))!.delta).toBe(0);
  });
  it("never settles in-progress, scheduled, or postponed", () => {
    expect(settlePick(1, 300, g("g", 1, 2, "in_progress"))).toBeNull();
    expect(settlePick(1, 300, g("g", 1, 2, "scheduled"))).toBeNull();
    expect(settlePick(1, 300, g("g", 1, 2, "postponed"))).toBeNull();
  });
  it("elimination at exactly zero", () => {
    expect(isEliminated(0)).toBe(true);
    expect(isEliminated(1)).toBe(false);
  });
  it("idempotency keys are stable per event", () => {
    expect(ledgerKeys.settlement("p1")).toBe(ledgerKeys.settlement("p1"));
    expect(ledgerKeys.settlement("p1")).not.toBe(ledgerKeys.settlement("p2"));
  });
});
