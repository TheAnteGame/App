import { NextRequest, NextResponse } from "next/server";
import { syncSchedule } from "@/lib/nfl/sync";
import { SEASON, BETA_LEAGUE_ID } from "@/lib/constants";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

/**
 * GET /api/jobs/sync-schedule — Authorization: Bearer ${CRON_SECRET} only.
 * Manual runs: GitHub Actions → run-job workflow (Run workflow button).
 * Optional ?week=N syncs a single week; default is all 18.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  const weeks = weekParam
    ? [Number(weekParam)]
    : Array.from({ length: 18 }, (_, i) => i + 1);

  const result = await syncSchedule(SEASON, weeks, BETA_LEAGUE_ID);
  const ok = result.errors.length === 0;
  return NextResponse.json(result, { status: ok ? 200 : 207 });
}
