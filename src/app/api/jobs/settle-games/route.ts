import { NextRequest, NextResponse } from "next/server";
import { settleGamesJob } from "@/lib/jobs";
import { syncSchedule } from "@/lib/nfl/sync";
import { SEASON, BETA_LEAGUE_ID } from "@/lib/constants";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

/**
 * Pinged every 10 min: refresh scores for weeks currently revealed, then
 * settle any official finals. Never guesses — unsettled picks wait.
 * `?sync=0` skips the ESPN refresh (used by the simulated-week harness so
 * test finals written to the DB aren't overwritten before settlement).
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  const doSync = req.nextUrl.searchParams.get("sync") !== "0";
  const sync = doSync
    ? await syncSchedule(
        SEASON,
        weekParam ? [Number(weekParam)] : currentWindowWeeks(),
        BETA_LEAGUE_ID,
      )
    : { gamesUpserted: 0, errors: ["sync skipped (?sync=0)"] as string[] };
  const result = await settleGamesJob();
  return NextResponse.json(
    { sync: { gamesUpserted: sync.gamesUpserted, errors: sync.errors }, ...result },
    { status: result.errors.length ? 207 : 200 },
  );
}

/** Weeks plausibly in-flight right now (cheap heuristic: all 18 pre-launch,
 * narrowed later; ESPN calls are fast and the job is idempotent). */
function currentWindowWeeks(): number[] {
  return Array.from({ length: 18 }, (_, i) => i + 1);
}
