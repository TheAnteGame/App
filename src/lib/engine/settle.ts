import type { GameLite, SettleOutcome } from "./types";

/**
 * Settlement (docs/02 §6): only official finals settle. Regular-season tie is
 * a PUSH (no points move, team use still counts). Canceled/voided → PUSH with
 * wager restored; team use preserved unless admin rules otherwise (handled at
 * the admin layer). Postponed games settle nothing — pick stays unsettled.
 *
 * Returns null when the game is not in a settleable state (the caller leaves
 * the pick untouched — "awaiting official result", never guess).
 */
export function settlePick(
  pickedTeamId: number,
  wager: number,
  game: GameLite,
): SettleOutcome | null {
  switch (game.status) {
    case "final": {
      if (game.winnerTeamId === null) {
        // official final with no winner = tie
        return { result: "push", delta: 0, usageCounts: true };
      }
      return game.winnerTeamId === pickedTeamId
        ? { result: "win", delta: +wager, usageCounts: true }
        : { result: "loss", delta: -wager, usageCounts: true };
    }
    case "canceled":
      return { result: "void", delta: 0, usageCounts: true }; // use preserved by default
    case "scheduled":
    case "in_progress":
    case "postponed":
      return null;
  }
}

/** Bankroll of 0 after settlement eliminates the player (docs/02 §7). */
export function isEliminated(bankrollAfter: number): boolean {
  return bankrollAfter <= 0;
}

/** Idempotency keys — one ledger row per event, ever (docs/03 Integrity). */
export const ledgerKeys = {
  startingBalance: (leagueId: string, userId: string) => `start:${leagueId}:${userId}`,
  settlement: (pickId: string) => `settle:${pickId}`,
  adminAdjustment: (auditId: string) => `admin:${auditId}`,
};
