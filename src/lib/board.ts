import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";

/**
 * Board + history + stats data (Phase 2). HARD RULE (CLAUDE.md): pre-reveal
 * picks are secret — every function here that returns other players' picks
 * checks `weeks.revealed_at` server-side first and returns nothing otherwise.
 */

export type BoardRow = {
  pickId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  eliminated: boolean;
  teamId: number;
  teamAbbr: string;
  teamName: string;
  wager: number;
  auto: boolean;
  isGhost: boolean;
  result: string | null;
  bankroll: number; // current stack (ghosts: 0-stakes shadow)
  gameId: string;
  gameStatus: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string;
};

export type WeekRowFull = {
  id: string;
  week: number;
  state: "upcoming" | "revealed" | "settled";
  lock_at: string;
  lock_source: string;
  revealed_at: string | null;
  is_overtime: boolean;
};

/** The revealed board for a week — or null if the week hasn't revealed. */
export async function revealedBoard(weekNumber: number): Promise<BoardRow[] | null> {
  const db = supabaseAdmin();
  const { data: week } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("week", weekNumber)
    .maybeSingle();
  if (!week || !week.revealed_at) return null; // PRIVACY BOUNDARY

  const [{ data: picks }, { data: users }, { data: teams }, { data: members }] =
    await Promise.all([
      db
        .from("picks")
        .select("*")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("week", weekNumber),
      db.from("users").select("id, first_name, last_name, status"),
      db.from("nfl_teams").select("id, abbr, name"),
      db.from("league_members").select("user_id, bankroll").eq("league_id", BETA_LEAGUE_ID),
    ]);

  const gameIds = [...new Set((picks ?? []).map((p) => p.game_id))];
  const { data: games } = gameIds.length
    ? await db.from("nfl_games").select("*").in("id", gameIds)
    : { data: [] };

  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const gameById = new Map((games ?? []).map((g) => [g.id, g]));
  const bankrollById = new Map((members ?? []).map((m) => [m.user_id, m.bankroll]));

  return (picks ?? [])
    .map((p) => {
      const u = userById.get(p.user_id);
      const t = teamById.get(p.team_id);
      const g = gameById.get(p.game_id);
      if (!u || !t || !g) return null;
      return {
        pickId: p.id,
        userId: p.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        eliminated: u.status === "eliminated",
        teamId: p.team_id,
        teamAbbr: t.abbr,
        teamName: t.name,
        wager: p.wager,
        auto: p.pick_type === "auto",
        isGhost: p.is_ghost,
        result: p.result,
        bankroll: bankrollById.get(p.user_id) ?? 0,
        gameId: p.game_id,
        gameStatus: g.status,
        homeAbbr: teamById.get(g.home_team_id)?.abbr ?? "?",
        awayAbbr: teamById.get(g.away_team_id)?.abbr ?? "?",
        homeScore: g.home_score,
        awayScore: g.away_score,
        kickoffAt: g.kickoff_at,
      } satisfies BoardRow;
    })
    .filter((r): r is BoardRow => r !== null)
    .sort((a, b) => Number(a.isGhost) - Number(b.isGhost) || b.wager - a.wager);
}

/** Pre-reveal: names-only submission status for the current week. */
export async function submissionStatus(weekNumber: number) {
  const db = supabaseAdmin();
  const [{ data: actives }, { data: picks }] = await Promise.all([
    db.from("users").select("id, first_name, last_name, status").in("status", ["active", "eliminated"]),
    db
      .from("picks")
      .select("user_id") // NEVER select team/wager here
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("week", weekNumber),
  ]);
  const anted = new Set((picks ?? []).map((p) => p.user_id));
  return (actives ?? []).map((u) => ({
    userId: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    eliminated: u.status === "eliminated",
    anted: anted.has(u.id),
  }));
}

/** All weeks with state, for schedule/history navigation. */
export async function allWeeks(): Promise<WeekRowFull[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .order("week");
  return (data ?? []) as WeekRowFull[];
}

/** Full season schedule (all games, all weeks) with team abbrs resolved. */
export async function seasonSchedule() {
  const db = supabaseAdmin();
  const [{ data: games }, { data: teams }] = await Promise.all([
    db.from("nfl_games").select("*").eq("season", SEASON).order("kickoff_at"),
    db.from("nfl_teams").select("id, abbr, name"),
  ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  return (games ?? []).map((g) => ({
    id: g.id,
    week: g.week,
    kickoffAt: g.kickoff_at,
    status: g.status,
    homeAbbr: teamById.get(g.home_team_id)?.abbr ?? "?",
    homeName: teamById.get(g.home_team_id)?.name ?? "?",
    awayAbbr: teamById.get(g.away_team_id)?.abbr ?? "?",
    awayName: teamById.get(g.away_team_id)?.name ?? "?",
    homeScore: g.home_score,
    awayScore: g.away_score,
    winnerTeamId: g.winner_team_id,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
  }));
}

/** Standings + season W-L + rank movement vs the previous snapshot. */
export async function tableData() {
  const db = supabaseAdmin();
  const [{ data: rows }, { data: results }, { data: snaps }] = await Promise.all([
    db.from("current_standings").select("*").eq("league_id", BETA_LEAGUE_ID).order("rank"),
    db
      .from("picks")
      .select("user_id, result, wager, pick_type")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("is_ghost", false)
      .eq("state", "settled"),
    db
      .from("standings_snapshots")
      .select("user_id, week, rank")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .order("week", { ascending: false }),
  ]);

  const agg = new Map<
    string,
    { w: number; l: number; p: number; biggestWin: number; totalAnted: number; n: number; autos: number }
  >();
  for (const r of results ?? []) {
    const a = agg.get(r.user_id) ?? { w: 0, l: 0, p: 0, biggestWin: 0, totalAnted: 0, n: 0, autos: 0 };
    if (r.result === "win") {
      a.w += 1;
      a.biggestWin = Math.max(a.biggestWin, r.wager);
    } else if (r.result === "loss") a.l += 1;
    else a.p += 1;
    a.totalAnted += r.wager;
    a.n += 1;
    if (r.pick_type === "auto") a.autos += 1;
    agg.set(r.user_id, a);
  }

  const latestSnapWeek = snaps?.[0]?.week ?? null;
  const prevRank = new Map<string, number>();
  if (latestSnapWeek !== null) {
    for (const s of snaps ?? []) {
      if (s.week === latestSnapWeek && !prevRank.has(s.user_id)) prevRank.set(s.user_id, s.rank);
    }
  }

  return (rows ?? []).map((r) => {
    const a = agg.get(r.user_id);
    return {
      userId: r.user_id as string,
      firstName: r.first_name as string | null,
      lastName: r.last_name as string | null,
      eliminated: r.status === "eliminated",
      bankroll: r.bankroll as number,
      rank: r.rank as number,
      wins: a?.w ?? 0,
      losses: a?.l ?? 0,
      pushes: a?.p ?? 0,
      biggestWin: a?.biggestWin ?? 0,
      avgAnte: a && a.n > 0 ? Math.round(a.totalAnted / a.n) : 0,
      autos: a?.autos ?? 0,
      prevRank: prevRank.get(r.user_id) ?? null,
    };
  });
}

/** Everything the stats engine needs (settled picks + snapshots + names). */
export async function statsFeed() {
  const db = supabaseAdmin();
  const [{ data: picks }, { data: snaps }, { data: users }, { data: teams }, { data: weeks }] =
    await Promise.all([
      db
        .from("picks")
        .select("user_id, week, team_id, wager, pick_type, is_ghost, result, state")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON),
      db
        .from("standings_snapshots")
        .select("user_id, week, bankroll, rank")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON),
      db.from("users").select("id, first_name, last_name"),
      db.from("nfl_teams").select("id, name"),
      db
        .from("weeks")
        .select("week, state")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .eq("state", "settled")
        .order("week", { ascending: false })
        .limit(1),
    ]);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const names = new Map(
    (users ?? []).map((u) => [u.id, `${u.first_name ?? "?"} ${(u.last_name ?? "?")[0] ?? ""}.`]),
  );
  return {
    names,
    lastSettledWeek: weeks?.[0]?.week ?? null,
    picks: (picks ?? [])
      .filter((p) => p.state === "settled")
      .map((p) => ({
        userId: p.user_id,
        week: p.week,
        teamName: teamById.get(p.team_id) ?? "?",
        wager: p.wager,
        auto: p.pick_type === "auto",
        isGhost: p.is_ghost,
        result: p.result,
      })),
    snapshots: (snaps ?? []).map((s) => ({
      userId: s.user_id,
      week: s.week,
      bankroll: s.bankroll,
      rank: s.rank,
    })),
  };
}

/** Settled weeks with their boards + post-week standings (Week history). */
export async function historyWeeks() {
  const db = supabaseAdmin();
  const [{ data: weeks }, { data: snaps }, { data: users }] = await Promise.all([
    db
      .from("weeks")
      .select("week")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("state", "settled")
      .order("week"),
    db
      .from("standings_snapshots")
      .select("user_id, week, rank, bankroll")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .order("rank"),
    db.from("users").select("id, first_name, last_name"),
  ]);
  const nameOf = new Map(
    (users ?? []).map((u) => [u.id, `${u.first_name ?? "?"} ${(u.last_name ?? "?")[0] ?? ""}.`]),
  );
  const out = [];
  for (const w of weeks ?? []) {
    const rows = await revealedBoard(w.week);
    out.push({
      week: w.week,
      rows: rows ?? [],
      standings: (snaps ?? [])
        .filter((s) => s.week === w.week)
        .map((s) => ({
          userId: s.user_id,
          name: nameOf.get(s.user_id) ?? "?",
          rank: s.rank,
          bankroll: s.bankroll,
        })),
    });
  }
  return out;
}

/** Per-user team usage for the inventory (counts + last-used week). */
export async function teamUsage(userId: string) {
  const db = supabaseAdmin();
  const { data: picks } = await db
    .from("picks")
    .select("week, team_id")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("user_id", userId);
  const usage = new Map<number, number[]>();
  for (const p of picks ?? []) {
    usage.set(p.team_id, [...(usage.get(p.team_id) ?? []), p.week].sort((a, b) => a - b));
  }
  return usage;
}
