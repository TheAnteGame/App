import { describe, it, expect } from "vitest";
import { eligibilityFor } from "./context";
import { normalizeEspnEvent } from "../nfl/espn";

const H = (
  week: number,
  team_id: number,
  result: string | null,
  is_ghost = false,
) => ({ week, team_id, result, state: "settled", is_ghost });

describe("eligibilityFor (docs/02 §3, §6)", () => {
  it("counts wins, losses, pushes AND voids toward usage", () => {
    const input = eligibilityFor(5, [], [
      H(1, 7, "win"),
      H(2, 7, "void"), // canceled game — use preserved per docs/02 §6
      H(3, 9, "push"),
    ]);
    expect(input.usage.get(7)).toBe(2); // team 7 is used up
    expect(input.usage.get(9)).toBe(1);
  });

  it("void in the prior week still blocks back-to-back", () => {
    const input = eligibilityFor(5, [], [H(4, 12, "void")]);
    expect(input.priorWeekTeamId).toBe(12);
  });

  it("same/future weeks never count", () => {
    const input = eligibilityFor(5, [], [
      H(5, 4, null), // same week
      H(6, 5, null), // future
    ]);
    expect(input.usage.size).toBe(0);
    expect(input.priorWeekTeamId).toBeNull();
  });

  it("ghost picks count toward the ghost's own limits (decision Aug 12)", () => {
    const input = eligibilityFor(6, [], [
      H(2, 3, "win"), // real pick before busting
      H(4, 3, "loss", true), // ghost pick, same team
      H(5, 8, "win", true), // ghost pick last week
    ]);
    expect(input.usage.get(3)).toBe(2); // team 3 used up across real+ghost
    expect(input.priorWeekTeamId).toBe(8); // no back-to-back for ghosts either
  });
});

describe("normalizeEspnEvent winner inference (review fix #4)", () => {
  const event = (homeScore: string, awayScore: string, flags: { h?: boolean; a?: boolean } = {}) => ({
    id: "evt1",
    date: "2026-09-13T17:00:00Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home" as const, score: homeScore, winner: flags.h, team: { abbreviation: "KC" } },
          { homeAway: "away" as const, score: awayScore, winner: flags.a, team: { abbreviation: "DEN" } },
        ],
        status: { type: { state: "post", detail: "Final", completed: true } },
      },
    ],
  });

  it("uses ESPN winner flags when present", () => {
    expect(normalizeEspnEvent(event("13", "20", { a: true }), 2026, 1).winner_abbr).toBe("DEN");
  });

  it("derives the winner from the score when flags are missing", () => {
    expect(normalizeEspnEvent(event("27", "24"), 2026, 1).winner_abbr).toBe("KC");
    expect(normalizeEspnEvent(event("10", "31"), 2026, 1).winner_abbr).toBe("DEN");
  });

  it("only calls a tie when scores are genuinely equal", () => {
    expect(normalizeEspnEvent(event("17", "17"), 2026, 1).winner_abbr).toBeNull();
  });

  it("post-game state WITHOUT completed=true stays in_progress (strict official final)", () => {
    const e = event("27", "24");
    e.competitions[0].status.type.completed = false;
    expect(normalizeEspnEvent(e, 2026, 1).status).toBe("in_progress");
  });
});
