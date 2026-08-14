import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { currentWeek } from "@/lib/db";

/** Temporary diagnostic (CRON_SECRET-gated): what does the DB actually hold? */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const q = req.nextUrl.searchParams.get("secret");
  const auth = req.headers.get("authorization");
  if (!secret || (auth !== `Bearer ${secret}` && q !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const [{ data: weeks, error: weeksErr }, { count: games }, cw, { data: users }] =
    await Promise.all([
      db
        .from("weeks")
        .select("week, state, lock_at, lock_source, league_id, season")
        .order("week")
        .limit(20),
      db.from("nfl_games").select("id", { count: "exact", head: true }),
      currentWeek(),
      db.from("users").select("email, role, status"),
    ]);
  // Replicate currentWeek() exactly, but surface its error instead of eating it.
  const cwRaw = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .in("state", ["upcoming", "open", "locked", "revealed"])
    .order("week", { ascending: true })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    league: BETA_LEAGUE_ID,
    season: SEASON,
    weeksError: weeksErr?.message ?? null,
    weeksCount: weeks?.length ?? 0,
    weeks: (weeks ?? []).slice(0, 2),
    gamesCount: games,
    currentWeekResult: cw ?? null,
    cwRawData: cwRaw.data ?? null,
    cwRawError: cwRaw.error
      ? { message: cwRaw.error.message, details: cwRaw.error.details, code: cwRaw.error.code }
      : null,
    users,
  });
}
