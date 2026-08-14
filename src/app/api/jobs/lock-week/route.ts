import { NextRequest, NextResponse } from "next/server";
import { lockWeekJob } from "@/lib/jobs";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

/** Pinged every 5 min (no-op unless a week's lock_at has passed). */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await lockWeekJob();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
