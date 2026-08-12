import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Job-route auth (review finding, Aug 12): Bearer header ONLY — the old
 * `?secret=` query param leaked the secret into request logs and browser
 * history — compared in constant time so the check can't be timing-probed.
 * Manual triggering now goes through the `run-job` GitHub Actions workflow
 * (Actions → run-job → Run workflow), which holds CRON_SECRET as a repo secret.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}
