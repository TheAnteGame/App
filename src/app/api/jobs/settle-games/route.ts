import { NextRequest, NextResponse } from "next/server";
import { settleGamesJob } from "@/lib/jobs";
import { syncSchedule } from "@/lib/nfl/sync";
import { SEASON, BETA_LEAGUE_ID } from "@/lib/constants";

export const maxDuration = 300;

/**
 * Vercel Cron every 10 min: refresh scores for weeks currently revealed, then
 * settle any official finals. Never guesses — unsettled picks wait.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const q = req.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && q !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  // Refresh scores first so settlement sees fresh finals.
  const sync = await syncSchedule(
    SEASON,
    weekParam ? [Number(weekParam)] : currentWindowWeeks(),
    BETA_LEAGUE_ID,
  );
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
