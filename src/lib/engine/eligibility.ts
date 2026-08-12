import type { GameLite } from "./types";

/**
 * Team eligibility (docs/02 §3): a team is pickable for a given week iff
 *  1. it plays that week (not on bye, game not canceled),
 *  2. the player has used it fewer than maxUses times (default 2),
 *  3. it is not the team the player used the previous week.
 */
export type EligibilityInput = {
  week: number;
  games: GameLite[]; // that week's games
  /** teamId -> number of prior uses (settled + locked picks) */
  usage: Map<number, number>;
  /** team used in week-1, or null */
  priorWeekTeamId: number | null;
  maxUses?: number;
};

export type TeamEligibility = {
  teamId: number;
  eligible: boolean;
  reason: "ok" | "bye" | "used_max" | "used_last_week";
  gameId: string | null;
};

export function teamsPlaying(games: GameLite[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const g of games) {
    if (g.status === "canceled") continue;
    map.set(g.homeTeamId, g.id);
    map.set(g.awayTeamId, g.id);
  }
  return map;
}

export function evaluateTeam(
  teamId: number,
  input: EligibilityInput,
): TeamEligibility {
  const playing = teamsPlaying(input.games);
  const gameId = playing.get(teamId) ?? null;
  const maxUses = input.maxUses ?? 2;

  if (!gameId) return { teamId, eligible: false, reason: "bye", gameId: null };
  if ((input.usage.get(teamId) ?? 0) >= maxUses)
    return { teamId, eligible: false, reason: "used_max", gameId };
  if (input.priorWeekTeamId === teamId)
    return { teamId, eligible: false, reason: "used_last_week", gameId };
  return { teamId, eligible: true, reason: "ok", gameId };
}

/** All eligible teamIds for the week (used by auto-pick and the inventory UI). */
export function eligibleTeams(
  allTeamIds: number[],
  input: EligibilityInput,
): TeamEligibility[] {
  return allTeamIds.map((id) => evaluateTeam(id, input));
}
