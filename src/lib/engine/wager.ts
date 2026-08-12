import type { WagerRules } from "./types";

export type WagerValidation =
  | { ok: true; wager: number }
  | { ok: false; error: string };

/**
 * Wager rules (docs/02 §2, §8):
 * - integer
 * - regular season: 100–1,000, never more than bankroll; if bankroll < 100 the
 *   player MUST wager the entire remaining bankroll (all-in)
 * - overtime (docs/02 §8, docs/05 #6): floor is 1 and the ceiling is the FULL
 *   bankroll (no 1,000 cap — champion-tie bankrolls exceed 1,000 routinely);
 *   distinctness across tied players is enforced at the DB level by a partial
 *   unique index
 */
export function validateWager(
  wager: number,
  bankroll: number,
  rules: WagerRules,
): WagerValidation {
  if (!Number.isInteger(wager)) return { ok: false, error: "Wager must be a whole number." };
  if (bankroll <= 0) return { ok: false, error: "No bankroll left to wager." };

  const floor = rules.isOvertime ? 1 : rules.min;
  const ceiling = rules.isOvertime ? bankroll : rules.max;

  if (!rules.isOvertime && bankroll < rules.min) {
    // Sub-100 stack: forced all-in, nothing else is legal.
    if (wager !== bankroll)
      return {
        ok: false,
        error: `Stack under ${rules.min} — you must ante your whole ${bankroll}.`,
      };
    return { ok: true, wager };
  }

  if (wager < floor) return { ok: false, error: `Minimum ante is ${floor}.` };
  if (wager > ceiling) return { ok: false, error: `Maximum ante is ${ceiling}.` };
  if (wager > bankroll)
    return { ok: false, error: `You can't ante more than your stack (${bankroll}).` };
  return { ok: true, wager };
}

/** Auto-pick wager (docs/02 §5): 100, or the whole bankroll if under 100. */
export function autoWager(bankroll: number, min = 100): number {
  return bankroll < min ? bankroll : min;
}
