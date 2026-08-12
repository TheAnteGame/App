import { eligibleTeams, type EligibilityInput } from "./eligibility";

/**
 * Seeded, idempotent auto-pick (docs/02 §5, docs/05 defaults):
 * randomness is seeded per (userId, season, week) so re-running the lock job
 * can never change an assigned team. FNV-1a hash → mulberry32 PRNG.
 */

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type AutoPickResult = { teamId: number; gameId: string } | null;

/**
 * Returns the deterministic auto-pick for a straggler, or null if no team is
 * eligible (only possible in degenerate schedules; the caller flags for admin).
 */
export function autoPick(
  userId: string,
  season: number,
  allTeamIds: number[],
  input: EligibilityInput,
): AutoPickResult {
  const pool = eligibleTeams(allTeamIds, input)
    .filter((t) => t.eligible)
    .sort((a, b) => a.teamId - b.teamId); // stable order before seeded draw

  if (pool.length === 0) return null;

  const rand = mulberry32(fnv1a(`${userId}:${season}:${input.week}`));
  const chosen = pool[Math.floor(rand() * pool.length)];
  return { teamId: chosen.teamId, gameId: chosen.gameId! };
}
