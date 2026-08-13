/* eslint-disable react-hooks/purity -- dev-only mock page (404s in prod);
   Date.now() feeds fake countdowns and is fine per-request on the server. */
import { notFound } from "next/navigation";
import { buildNotices } from "@/lib/engine/notices";
import { weeklySuperlatives, seasonRecords, type StatsInput } from "@/lib/engine/stats";
import type { BoardRow } from "@/lib/board";
import type { GameLite } from "@/lib/engine/types";
import AnteCard, { type EligibleTeam } from "@/components/AnteCard";
import RichEditor from "@/components/RichEditor";
import { CONTENT_DEFAULTS } from "@/lib/content";
import RevealBoard from "@/components/RevealBoard";
import NoticesTicker from "@/components/NoticesTicker";
import TheTable, { type TableRow } from "@/components/TheTable";
import TeamInventory, { type InventoryTeam, type ScheduleGame } from "@/components/TeamInventory";
import SchedulePanel from "@/components/SchedulePanel";
import HistoryPanel from "@/components/HistoryPanel";
import StatsPanels from "@/components/StatsPanels";
import { VOCAB } from "@/lib/brand";

/**
 * DESIGN PREVIEW — mock-data render of every Phase 2 surface, for visual QA
 * (local Playwright screenshots). Gated: 404s unless ALLOW_PREVIEW=1 (never
 * set in production). No DB, no auth — everything below is fabricated.
 */

export const dynamic = "force-dynamic";

const P = [
  { id: "u1", first: "Robert", last: "Toler" },
  { id: "u2", first: "Marissa", last: "Kane" },
  { id: "u3", first: "Dre", last: "Wallace" },
  { id: "u4", first: "Sam", last: "Ortiz" },
  { id: "u5", first: "Kelly", last: "Nguyen" },
  { id: "u6", first: "Jae", last: "Park" },
  { id: "u7", first: "Tony", last: "Marchetti" },
  { id: "u8", first: "Bea", last: "Okafor" },
];

const TEAM_NAMES: [string, string][] = [
  ["SEA", "Seahawks"], ["NE", "Patriots"], ["KC", "Chiefs"], ["BUF", "Bills"],
  ["DET", "Lions"], ["PHI", "Eagles"], ["DAL", "Cowboys"], ["GB", "Packers"],
  ["SF", "49ers"], ["BAL", "Ravens"], ["MIA", "Dolphins"], ["CIN", "Bengals"],
  ["NYJ", "Jets"], ["MIN", "Vikings"], ["LAC", "Chargers"], ["PIT", "Steelers"],
  ["ATL", "Falcons"], ["NO", "Saints"], ["TB", "Buccaneers"], ["CAR", "Panthers"],
  ["CHI", "Bears"], ["CLE", "Browns"], ["DEN", "Broncos"], ["HOU", "Texans"],
  ["IND", "Colts"], ["JAX", "Jaguars"], ["LV", "Raiders"], ["LAR", "Rams"],
  ["NYG", "Giants"], ["TEN", "Titans"], ["WSH", "Commanders"], ["ARI", "Cardinals"],
];

function mockSchedule(): ScheduleGame[] {
  const games: ScheduleGame[] = [];
  for (let w = 1; w <= 18; w++) {
    for (let i = 0; i < 16; i++) {
      const home = ((i * 2 + w) % 32) + 1;
      const away = ((i * 2 + w + 1) % 32) + 1;
      if (home === away) continue;
      const past = w < 4;
      games.push({
        id: `g-${w}-${i}`,
        week: w,
        kickoffAt: new Date(Date.UTC(2026, 8, 9 + (w - 1) * 7 + (i % 3), 17 + (i % 3) * 3, 20)).toISOString(),
        status: past ? "final" : w === 4 && i < 2 ? "in_progress" : "scheduled",
        homeAbbr: TEAM_NAMES[home - 1][0],
        homeName: TEAM_NAMES[home - 1][1],
        awayAbbr: TEAM_NAMES[away - 1][0],
        awayName: TEAM_NAMES[away - 1][1],
        homeScore: past || (w === 4 && i < 2) ? 20 + (i % 14) : null,
        awayScore: past || (w === 4 && i < 2) ? 13 + ((i * 3) % 17) : null,
        winnerTeamId: past ? (i % 3 === 0 ? away : home) : null,
        homeTeamId: home,
        awayTeamId: away,
      });
    }
  }
  return games;
}

function mockBoard(settledSome: boolean): BoardRow[] {
  const mk = (
    i: number, teamIdx: number, wager: number, bankroll: number,
    opts: Partial<BoardRow> = {},
  ): BoardRow => ({
    pickId: `p${i}`,
    userId: P[i].id,
    firstName: P[i].first,
    lastName: P[i].last,
    eliminated: false,
    teamId: teamIdx + 1,
    teamAbbr: TEAM_NAMES[teamIdx][0],
    teamName: TEAM_NAMES[teamIdx][1],
    wager,
    auto: false,
    isGhost: false,
    result: null,
    bankroll,
    gameId: `g-4-${i % 5}`,
    gameStatus: "scheduled",
    homeAbbr: TEAM_NAMES[(teamIdx + 4) % 32][0],
    awayAbbr: TEAM_NAMES[teamIdx][0],
    homeScore: null,
    awayScore: null,
    kickoffAt: new Date(Date.UTC(2026, 8, 27, 17, 0)).toISOString(),
    ...opts,
  });
  return [
    mk(0, 2, 450, 1550, settledSome ? { result: "win", gameStatus: "final", homeScore: 17, awayScore: 27 } : {}),
    mk(1, 4, 1000, 1210, { gameStatus: "in_progress", homeScore: 10, awayScore: 14 }),
    mk(2, 8, 300, 980, settledSome ? { result: "loss", gameStatus: "final", homeScore: 24, awayScore: 20 } : {}),
    mk(3, 11, 250, 1040, { auto: true }),
    mk(4, 6, 600, 870, settledSome ? { result: "push", gameStatus: "final", homeScore: 21, awayScore: 21 } : {}),
    mk(5, 13, 100, 430, {}),
    mk(6, 19, 500, 500, {}),
    mk(7, 22, 350, 0, { isGhost: true, eliminated: true, bankroll: 1000 }),
  ];
}

function mockTable(): TableRow[] {
  const stacks = [1550, 1210, 1040, 980, 870, 500, 430];
  return [
    ...P.slice(0, 7).map((p, i) => ({
      userId: p.id,
      firstName: p.first,
      lastName: p.last,
      eliminated: false,
      bankroll: stacks[i],
      rank: i + 1,
      wins: 5 - (i % 4),
      losses: 1 + (i % 3),
      pushes: i % 2,
      biggestWin: 600 - i * 50,
      avgAnte: 420 - i * 30,
      autos: i % 2,
      prevRank: i === 0 ? 2 : i === 1 ? 1 : i + 1,
      anted: i % 3 !== 2,
    })),
    {
      userId: P[7].id, firstName: P[7].first, lastName: P[7].last,
      eliminated: true, bankroll: 0, rank: 8, wins: 2, losses: 4, pushes: 0,
      biggestWin: 300, avgAnte: 610, autos: 1, prevRank: 8, anted: true,
    },
  ];
}

export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.ALLOW_PREVIEW !== "1") notFound();
  const { state } = await searchParams;
  const revealed = state !== "pre";

  const schedule = mockSchedule();
  const board = mockBoard(revealed);
  const table = mockTable();
  const games: GameLite[] = schedule
    .filter((g) => g.week === 4)
    .map((g) => ({
      id: g.id, week: 4, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      kickoffAt: new Date(g.kickoffAt),
      status: g.status as GameLite["status"],
      winnerTeamId: g.winnerTeamId,
    }));

  const notices = buildNotices({
    weekNumber: 4,
    state: revealed ? "revealed" : "upcoming",
    lockAtIso: new Date(Date.now() + (revealed ? -3600e3 : 2.2 * 3600e3)).toISOString(),
    nowIso: new Date().toISOString(),
    standings: table.map((r) => ({
      userId: r.userId,
      name: `${r.firstName} ${r.lastName?.[0]}.`,
      bankroll: r.bankroll,
      rank: r.rank,
      eliminated: r.eliminated,
    })),
    antedUserIds: table.filter((r) => r.anted).map((r) => r.userId),
    board: revealed
      ? board.map((b) => ({
          userId: b.userId, teamId: b.teamId, teamName: b.teamName, wager: b.wager,
          isGhost: b.isGhost, auto: b.auto, result: b.result, gameId: b.gameId,
        }))
      : [],
    games,
  });

  const statsInput: StatsInput = {
    names: new Map(P.map((p) => [p.id, `${p.first} ${p.last[0]}.`])),
    lastSettledWeek: 3,
    picks: [
      { userId: "u1", week: 3, teamName: "Chiefs", wager: 600, auto: false, isGhost: false, result: "win" },
      { userId: "u2", week: 3, teamName: "Bills", wager: 800, auto: false, isGhost: false, result: "loss" },
      { userId: "u3", week: 3, teamName: "Lions", wager: 100, auto: true, isGhost: false, result: "win" },
      { userId: "u1", week: 2, teamName: "Eagles", wager: 400, auto: false, isGhost: false, result: "win" },
      { userId: "u4", week: 2, teamName: "Ravens", wager: 350, auto: false, isGhost: false, result: "push" },
      { userId: "u2", week: 1, teamName: "Jets", wager: 500, auto: false, isGhost: false, result: "win" },
    ],
    snapshots: [
      { userId: "u1", week: 3, bankroll: 1550, rank: 1 },
      { userId: "u2", week: 3, bankroll: 1210, rank: 2 },
      { userId: "u1", week: 2, bankroll: 1100, rank: 2 },
    ],
  };

  const eligible: EligibleTeam[] = TEAM_NAMES.map(([abbr, name], i) => ({
    teamId: i + 1,
    abbr,
    name,
    eligible: i % 7 !== 3 && i !== 2,
    reason: i === 2 ? "used_last_week" : i % 7 === 3 ? (i % 2 ? "used_max" : "bye") : "ok",
    uses: i === 2 ? 1 : i % 7 === 3 && i % 2 ? 2 : i % 5 === 0 ? 1 : 0,
  }));
  const inventory: InventoryTeam[] = eligible.map((t) => ({
    teamId: t.teamId, abbr: t.abbr, name: t.name,
    usedWeeks: t.uses === 2 ? [1, 3] : t.uses === 1 ? [2] : [],
    eligible: t.eligible, reason: t.reason,
  }));

  const history = [
    {
      week: 3,
      rows: mockBoard(true).map((r) => ({ ...r, result: r.result ?? (r.wager > 400 ? "loss" : "win") })),
      standings: table.map((r) => ({
        userId: r.userId, name: `${r.firstName} ${r.lastName?.[0]}.`,
        rank: r.rank, bankroll: r.bankroll,
      })),
    },
  ];

  return (
    <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
      <p className="mb-4 rounded-lg border border-brand-purple/50 bg-brand-purple/10 px-3 py-2 text-xs text-ink-muted">
        DESIGN PREVIEW — mock data, {revealed ? "post-reveal" : "pre-reveal"} state
      </p>
      <div className="mb-5">
        <NoticesTicker notices={notices} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div>
          {revealed ? (
            <RevealBoard week={4} rows={board} meId="u1" settled={false} />
          ) : (
            <AnteCard
              week={4}
              lockAtIso={new Date(Date.now() + 2.2 * 3600e3).toISOString()}
              lockSource="default"
              bankroll={1550}
              teams={eligible}
              myPick={{ teamId: 3, wager: 450 }}
              isGhost={false}
            />
          )}
        </div>
        <TheTable rows={table} meId="u1" preReveal={!revealed} />
        <TeamInventory teams={inventory} schedule={schedule} currentWeek={4} />
        {/* Static Table Talk replica (live component needs Clerk) */}
        <section className="panel flex h-[420px] flex-col p-5 sm:p-6">
          <h2 className="display mb-3 text-xl font-bold uppercase">{VOCAB.chat}</h2>
          <div className="flex-1 space-y-2.5 overflow-hidden">
            {[
              { n: "Dre W.", b: "who let Sam ride the Cowboys twice 😂", mine: false },
              { n: "Sam O.", b: "champions take risks", mine: false },
              { n: "Robert T.", b: "the house thanks you for your donation", mine: true },
              { n: "Bea O.", b: "BUSTED but my shadow stack is UP. respect the ghost", mine: false },
              { n: "Kelly N.", b: "3 hours to lock and Tony still hasn't anted…", mine: false },
            ].map((m, i) => (
              <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.mine ? "rounded-br-sm bg-gold/15" : "rounded-bl-sm bg-surface-raised"}`}>
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {m.n}
                    {m.n === "Bea O." && <span className="ml-1.5 text-loss">{VOCAB.eliminated}</span>}
                    <span className="ml-2 font-normal normal-case">6:1{i} PM</span>
                  </p>
                  <p>{m.b}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-raised px-3.5 py-2.5 text-sm text-ink-muted/60">
              Talk your talk…
            </div>
            <div className="display rounded-xl bg-gold px-4 py-2.5 text-sm font-bold uppercase text-surface">
              Send
            </div>
          </div>
        </section>
      </div>
      <div className="mt-5 space-y-5">
        <SchedulePanel schedule={schedule} currentWeek={4} />
        <HistoryPanel weeks={history} />
        <StatsPanels
          weekly={weeklySuperlatives(statsInput)}
          season={seasonRecords(statsInput)}
          lastSettledWeek={3}
        />
        {/* Content studio widgets (rich editor + rendered .rich output) */}
        <section className="panel p-5 sm:p-6">
          <h2 className="display mb-4 text-xl font-bold uppercase">Rich editor (content studio)</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <RichEditor name="preview" initialHtml={CONTENT_DEFAULTS["howto.section2Html"]} />
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-ink-muted/70">Rendered</p>
              <div
                className="rich rounded-xl border border-edge/60 bg-surface-raised/40 p-4 text-sm"
                dangerouslySetInnerHTML={{ __html: CONTENT_DEFAULTS["howto.section1Html"] }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
