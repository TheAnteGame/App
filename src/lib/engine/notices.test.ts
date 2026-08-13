import { describe, it, expect } from "vitest";
import { buildNotices, type TickerInput } from "./notices";
import type { GameLite } from "./types";

const game = (id: string, status: GameLite["status"] = "scheduled"): GameLite => ({
  id, week: 1, homeTeamId: 1, awayTeamId: 2,
  kickoffAt: new Date("2026-09-09T20:20:00Z"), status, winnerTeamId: null,
});

const base: TickerInput = {
  weekNumber: 1,
  state: "upcoming",
  lockAtIso: "2026-09-10T00:15:00Z",
  nowIso: "2026-09-09T12:00:00Z",
  standings: [
    { userId: "a", name: "Alice A.", bankroll: 1200, rank: 1, eliminated: false },
    { userId: "b", name: "Bob B.", bankroll: 1000, rank: 2, eliminated: false },
    { userId: "c", name: "Cara C.", bankroll: 800, rank: 3, eliminated: false },
  ],
  antedUserIds: [],
  board: [],
  games: [game("g1")],
};

describe("buildNotices — pre-reveal", () => {
  it("counts antes, names stragglers, and never leaks a pick", () => {
    const n = buildNotices({ ...base, antedUserIds: ["a"] });
    const text = n.map((x) => x.text).join(" | ");
    expect(text).toContain("1 of 3 antes are in");
    expect(text).toContain("Waiting on Bob B., Cara C.");
    expect(text).toContain("Alice A. leads the table");
  });

  it("flags lock urgency inside 3 hours", () => {
    const n = buildNotices({ ...base, nowIso: "2026-09-09T22:30:00Z", antedUserIds: ["a", "b", "c"] });
    const text = n.map((x) => x.text).join(" | ");
    expect(text).toContain("Everyone's in");
    expect(text).toContain("Lock in 1h 45m");
  });
});

describe("buildNotices — revealed", () => {
  const revealed: TickerInput = {
    ...base,
    state: "revealed",
    board: [
      { userId: "a", teamId: 1, teamName: "Seahawks", wager: 300, isGhost: false, auto: false, result: null, gameId: "g1" },
      { userId: "b", teamId: 2, teamName: "Patriots", wager: 1000, isGhost: false, auto: false, result: null, gameId: "g1" },
      { userId: "c", teamId: 2, teamName: "Patriots", wager: 500, isGhost: false, auto: true, result: null, gameId: "g1" },
    ],
  };

  it("calls out all-ins, lead changes, auto-antes, shared fates, biggest swing", () => {
    const text = buildNotices(revealed).map((x) => x.text).join(" | ");
    expect(text).toContain("Antes are in.");
    expect(text).toContain("Bob B. is ALL-IN on the Patriots");
    expect(text).toContain("Bob B. takes the lead with a Patriots win");
    expect(text).toContain("AUTO-ANTE: the house put Cara C. on the Patriots");
    expect(text).toContain("Bob B. and Cara C. both ride with the Patriots");
    expect(text).toContain("Biggest swing on the board: Bob B.");
    expect(text).toContain("1 game left to decide the week");
  });

  it("all-in doubles as elimination risk (wager can never exceed stack)", () => {
    const input = {
      ...revealed,
      standings: base.standings.map((s) => (s.userId === "c" ? { ...s, bankroll: 500 } : s)),
    };
    const text = buildNotices(input).map((x) => x.text).join(" | ");
    expect(text).toContain("Cara C. is ALL-IN on the Patriots — a loss means BUSTED");
  });

  it("result callouts as finals land", () => {
    const input: TickerInput = {
      ...revealed,
      standings: base.standings.map((s) => (s.userId === "b" ? { ...s, bankroll: 0, eliminated: true } : s)),
      board: [
        { ...revealed.board[0], result: "win" },
        { ...revealed.board[1], result: "loss" },
        { ...revealed.board[2], result: "push" },
      ],
    };
    const text = buildNotices(input).map((x) => x.text).join(" | ");
    expect(text).toContain("Alice A. cashed +300 on the Seahawks");
    expect(text).toContain("Bob B. went bust on the Patriots — BUSTED");
    expect(text).toContain("Cara C. pushes");
  });
});

describe("buildNotices — settled", () => {
  it("closes the week with leader + chase margin", () => {
    const input: TickerInput = {
      ...base,
      state: "settled",
      standings: [
        { userId: "a", name: "Alice A.", bankroll: 1500, rank: 1, eliminated: false },
        { userId: "b", name: "Bob B.", bankroll: 1400, rank: 2, eliminated: false },
      ],
    };
    const text = buildNotices(input).map((x) => x.text).join(" | ");
    expect(text).toContain("Week 1 is in the books — Alice A. leads with 1500");
    expect(text).toContain("Bob B. is only 100 back");
  });
});
