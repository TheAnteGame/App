import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const LEAGUE_TZ = "America/New_York"; // never a fixed offset (docs/02 §4)

/** Buffer before the earliest kickoff when the early-game exception applies. */
export const EARLY_LOCK_BUFFER_MS = 5 * 60 * 1000;

export type LockComputation = {
  lockAt: Date;
  lockSource: "default" | "early_game";
};

/**
 * Compute a week's lock time from its kickoffs (docs/02 §4):
 * - Default: Thursday 3:00 PM Eastern of that NFL week.
 * - If any kickoff is earlier than that, lock moves to before the first
 *   kickoff (earliest kickoff minus buffer) and is flagged `early_game`.
 *   (Week 1 of 2026 opens Wednesday, so this fires from day one.)
 *
 * The "Thursday of the week" is anchored on the LATEST kickoff: the Thursday
 * on or before that day (in ET). NFL weeks end Sun/Mon, so this lands on the
 * week's own Thursday for every real slate — normal Thu–Mon weeks, weekend-only
 * slates, the Wednesday Week 1 opener (where the early-game rule then wins),
 * and Thanksgiving's 12:30 PM Thursday kickoff (early-game rule wins there too).
 */
export function computeLock(kickoffs: Date[]): LockComputation {
  if (kickoffs.length === 0) throw new Error("computeLock: no kickoffs");
  const earliest = new Date(Math.min(...kickoffs.map((k) => k.getTime())));
  const latest = new Date(Math.max(...kickoffs.map((k) => k.getTime())));

  // Walk back from the latest kickoff's ET day to Thursday (getDay: 0=Sun … 4=Thu).
  const anchorEt = toZonedTime(latest, LEAGUE_TZ);
  while (anchorEt.getDay() !== 4) anchorEt.setDate(anchorEt.getDate() - 1);
  anchorEt.setHours(15, 0, 0, 0);

  const defaultLock = fromZonedTime(anchorEt, LEAGUE_TZ);

  if (earliest.getTime() < defaultLock.getTime()) {
    return {
      lockAt: new Date(earliest.getTime() - EARLY_LOCK_BUFFER_MS),
      lockSource: "early_game",
    };
  }
  return { lockAt: defaultLock, lockSource: "default" };
}
