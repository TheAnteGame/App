import { NextRequest, NextResponse } from "next/server";
import { syncSchedule } from "@/lib/nfl/sync";
import { SEASON, BETA_LEAGUE_ID } from "@/lib/constants";

export const maxDuration = 300;

/**
 * Vercel Cron → GET /api/jobs/sync-schedule
 * Auth: Authorization: Bearer ${CRON_SECRET} (Vercel Cron sends this once the
 * CRON_SECRET env var exists) — or ?secret=${CRON_SECRET} for manual admin
 * triggering from a browser.
 * Optional ?week=N syncs a single week; default is all 18.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const authorized =
    Boolean(secret) && (auth === `Bearer ${secret}` || querySecret === secret);
  if (!authorized) {
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
