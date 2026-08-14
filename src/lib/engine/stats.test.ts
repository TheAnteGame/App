import { describe, it, expect } from "vitest";
import { weeklySuperlatives, seasonRecords, type StatsInput } from "./stats";

const names = new Map([
  ["a", "Alice A."],
  ["b", "Bob B."],
  ["c", "Cara C."],
]);

const input: StatsInput = {
  names,
  lastSettledWeek: 2,
  picks: [
    { userId: "a", week: 1, teamName: "Seahawks", wager: 300, auto: false, isGhost: false, result: "win" },
    { userId: "b", week: 1, teamName: "Patriots", wager: 800, auto: false, isGhost: false, result: "loss" },
    { userId: "c", week: 1, teamName: "Bills", wager: 100, auto: true, isGhost: false, result: "win" },
    { userId: "a", week: 2, teamName: "Chiefs", wager: 600, auto: false, isGhost: false, result: "win" },
    { userId: "b", week: 2, teamName: "Jets", wager: 200, auto: false, isGhost: false, result: "push" },
    { userId: "c", week: 2, teamName: "Lions", wager: 100, auto: true, isGhost: false, result: "loss" },
    // ghost pick must never surface in stats
    { userId: "b", week: 2, teamName: "Bears", wager: 1000, auto: false, isGhost: true, result: "win" },
  ],
  snapshots: [
    { userId: "a", week: 1, bankroll: 1300, rank: 1 },
    { userId: "a", week: 2, bankroll: 1900, rank: 1 },
    { userId: "b", week: 1, bankroll: 200, rank: 3 },
  ],
};

describe("weeklySuperlatives", () => {
  it("computes last settled week's callouts, ignoring ghosts", () => {
    const s = weeklySuperlatives(input);
    const by = Object.fromEntries(s.map((x) => [x.key, x.detail]));
    expect(by["biggest-win"]).toBe("Alice A. — +600 on the Chiefs");
    expect(by["toughest-beat"]).toBe("Cara C. — −100 on the Lions");
    expect(by["boldest-ante"]).toBe("Alice A. — 600 on the Chiefs");
    expect(by["house-guests"]).toBe("Cara C.");
  });

  it("returns nothing before any settled week", () => {
    expect(weeklySuperlatives({ ...input, lastSettledWeek: null })).toEqual([]);
  });
});

describe("seasonRecords", () => {
  it("computes wins, risk, high-water, and streaks (push preserves a streak)", () => {
    const s = seasonRecords(input);
    const by = Object.fromEntries(s.map((x) => [x.key, x.detail]));
    expect(by["most-wins"]).toBe("Alice A. — 2");
    expect(by["riskiest"]).toBe("Bob B. — 500 average ante");
    expect(by["high-water"]).toBe("Alice A. — 1900 after Week 2");
    expect(by["hot-hand"]).toBe("Alice A. — 2 straight");
  });
});
