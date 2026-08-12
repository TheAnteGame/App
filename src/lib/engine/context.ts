import type { GameLite } from "./types";
import type { EligibilityInput } from "./eligibility";

/** Pure helpers shared by server code and tests (no server-only imports). */

export function toGameLite(g: Record<string, unknown>): GameLite {
  return {
    id: g.id as string,
    week: g.week as number,
    homeTeamId: g.home_team_id as number,
    awayTeamId: g.away_team_id as number,
    kickoffAt: new Date(g.kickoff_at as string),
    status: g.status as GameLite["status"],
    winnerTeamId: (g.winner_team_id as number | null) ?? null,
  };
}

export type PickHistoryRow = {
  week: number;
  team_id: number;
  result: string | null;
  state: string;
  is_ghost: boolean;
};

/** Build the eligibility input for a user+week from their pick history. */
export function eligibilityFor(
  week: number,
  games: GameLite[],
  history: PickHistoryRow[],
): EligibilityInput {
  const usage = new Map<number, number>();
  let priorWeekTeamId: number | null = null;
  for (const p of history) {
    if (p.week >= week) continue;
    // docs/02 §6: ties AND canceled/voided picks both keep consuming the team
    // use ("team use preserved"); only an explicit admin ruling refunds it
    // (that ruling deletes/alters the pick row, which drops it from history).
    // Ghost picks count too (decision, Aug 12): ghosts play by the same
    // team-use rules against their own full history — only ever relevant to
    // the ghost's own eligibility, since active players have no ghost rows.
    usage.set(p.team_id, (usage.get(p.team_id) ?? 0) + 1);
    if (p.week === week - 1) priorWeekTeamId = p.team_id;
  }
  return { week, games, usage, priorWeekTeamId };
}
