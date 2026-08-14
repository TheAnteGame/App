import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

/**
 * Read-only integrity check (CLAUDE.md: "bankroll is reproducible from the
 * ledger"). For every member: cached bankroll vs ledger sum. Plus week states
 * and pick-state counts per week. Used by the simulated-week harness and as a
 * standing ops check; groundwork for the Phase 3 reconcile run.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();

  const [{ data: members }, { data: ledger }, { data: weeks }, { data: picks }, { data: users }] =
    await Promise.all([
      db.from("league_members").select("user_id, bankroll").eq("league_id", BETA_LEAGUE_ID),
      db.from("ledger").select("user_id, amount").eq("league_id", BETA_LEAGUE_ID),
      db
        .from("weeks")
        .select("week, state, lock_at, revealed_at")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .order("week"),
      db
        .from("picks")
        .select("week, state, is_ghost, result")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON),
      db.from("users").select("id, email, status"),
    ]);

  const ledgerSum = new Map<string, number>();
  for (const row of ledger ?? []) {
    ledgerSum.set(row.user_id, (ledgerSum.get(row.user_id) ?? 0) + row.amount);
  }
  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));
  const statusById = new Map((users ?? []).map((u) => [u.id, u.status]));

  const bankrolls = (members ?? []).map((m) => {
    const fromLedger = ledgerSum.get(m.user_id) ?? 0;
    return {
      email: emailById.get(m.user_id) ?? m.user_id,
      status: statusById.get(m.user_id) ?? "?",
      cached: m.bankroll,
      fromLedger,
      ok: m.bankroll === fromLedger,
    };
  });

  const pickCounts: Record<number, Record<string, number>> = {};
  for (const p of picks ?? []) {
    const w = (pickCounts[p.week] ??= {});
    const key = `${p.state}${p.is_ghost ? ":ghost" : ""}${p.result ? `:${p.result}` : ""}`;
    w[key] = (w[key] ?? 0) + 1;
  }

  const mismatches = bankrolls.filter((b) => !b.ok);
  return NextResponse.json(
    { reconciled: mismatches.length === 0, mismatches, bankrolls, weeks, pickCounts },
    { status: mismatches.length === 0 ? 200 : 207 },
  );
}
