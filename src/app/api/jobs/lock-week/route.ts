import { NextRequest, NextResponse } from "next/server";
import { lockWeekJob } from "@/lib/jobs";

export const maxDuration = 300;

/** Vercel Cron every 5 min (no-op unless a week's lock_at has passed). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const q = req.nextUrl.searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && q !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await lockWeekJob();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
