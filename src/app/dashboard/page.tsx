import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { BRAND, VOCAB } from "@/lib/brand";
import {
  requireUser,
  profileComplete,
  currentWeek,
  weekGames,
  memberContext,
  allTeams,
} from "@/lib/db";
import {
  revealedBoard,
  submissionStatus,
  seasonSchedule,
  tableData,
  statsFeed,
  historyWeeks,
} from "@/lib/board";
import { recentMessages } from "@/lib/chat";
import { getContent, getTickerItems } from "@/lib/content";
import { eligibilityFor, toGameLite } from "@/lib/picks";
import { evaluateTeam } from "@/lib/engine/eligibility";
import { buildNotices } from "@/lib/engine/notices";
import { weeklySuperlatives, seasonRecords } from "@/lib/engine/stats";
import AnteCard, { type EligibleTeam } from "@/components/AnteCard";
import RevealBoard from "@/components/RevealBoard";
import NoticesTicker from "@/components/NoticesTicker";
import TheTable from "@/components/TheTable";
import TeamInventory, { type InventoryTeam } from "@/components/TeamInventory";
import TableTalk from "@/components/TableTalk";
import SchedulePanel from "@/components/SchedulePanel";
import HistoryPanel from "@/components/HistoryPanel";
import StatsPanels from "@/components/StatsPanels";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "week", label: "This week" },
  { id: "table", label: "The Table" },
  { id: "teams", label: "Teams" },
  { id: "talk", label: "Table Talk" },
  { id: "schedule", label: "Schedule" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
];

/** Page 4 — Player Dashboard (wireframe 4), Phase 2: the full live league. */
export default async function Dashboard() {
  const user = await requireUser();
  if (!user) redirect("/");
  if (!profileComplete(user)) redirect("/welcome");

  // Pending: only How to Play + status (docs/01 page 2)
  if (user.status === "pending") {
    const c = await getContent();
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="stage" aria-hidden="true">
          <div className="stage-blob stage-blob--gold" />
          <div className="stage-sweep" />
        </div>
        <div className="relative z-10 max-w-md">
          <Image src={BRAND.logoOnDark} alt={BRAND.name} width={400} height={268} className="mx-auto mb-8 h-auto w-44" priority />
          <h1 className="display mb-3 text-3xl font-bold uppercase">{c["pending.title"]}</h1>
          <p className="mb-8 text-ink-muted">{c["pending.body"]}</p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <Link href="/how-to-play" className="text-gold underline-offset-2 hover:underline">
              Read how to play →
            </Link>
            <SignOutButton>
              <button className="text-ink-muted hover:text-ink">Log out</button>
            </SignOutButton>
          </div>
        </div>
      </main>
    );
  }

  if (user.status === "removed") redirect("/");
  if (!user.rules_accepted_at) redirect("/how-to-play");

  const week = await currentWeek();
  const weekNumber = week?.week ?? 1;
  const revealed = Boolean(week?.revealed_at);

  const [gamesRaw, ctx, table, teams, board, subs, schedule, chat, stats, history, customTicker] =
    await Promise.all([
      week ? weekGames(week.week) : Promise.resolve([]),
      memberContext(user.id),
      tableData(),
      allTeams(),
      week && week.revealed_at ? revealedBoard(week.week) : Promise.resolve(null),
      week ? submissionStatus(week.week) : Promise.resolve([]),
      seasonSchedule(),
      recentMessages(),
      statsFeed(),
      historyWeeks(),
      getTickerItems(),
    ]);

  const games = gamesRaw.map(toGameLite);
  const isGhost = user.status === "eliminated";
  const myRow = table.find((r) => r.userId === user.id);
  const anted = new Set(subs.filter((s) => s.anted).map((s) => s.userId));

  // Eligibility (shared by ante card + inventory)
  const input = eligibilityFor(weekNumber, games, ctx.picks);
  const eligible: EligibleTeam[] = teams.map((t) => {
    const e = evaluateTeam(t.id, input);
    return {
      teamId: t.id,
      abbr: t.abbr,
      name: t.name,
      eligible: e.eligible,
      reason: e.reason,
      uses: input.usage.get(t.id) ?? 0,
    };
  });
  const inventory: InventoryTeam[] = teams.map((t) => {
    const e = evaluateTeam(t.id, input);
    return {
      teamId: t.id,
      abbr: t.abbr,
      name: t.name,
      usedWeeks: ctx.picks.filter((p) => p.team_id === t.id).map((p) => p.week),
      eligible: e.eligible,
      reason: e.reason,
    };
  });

  // Notices ticker: commissioner items first, then the computed callouts.
  const computedNotices = buildNotices({
    weekNumber,
    state: (week?.state ?? "upcoming") as "upcoming" | "revealed" | "settled",
    lockAtIso: week?.lock_at ?? new Date().toISOString(),
    nowIso: new Date().toISOString(),
    standings: table.map((r) => ({
      userId: r.userId,
      name: `${r.firstName ?? "?"} ${(r.lastName ?? "?")[0] ?? ""}.`,
      bankroll: r.bankroll,
      rank: r.rank,
      eliminated: r.eliminated,
    })),
    antedUserIds: [...anted],
    board: (board ?? []).map((b) => ({
      userId: b.userId,
      teamId: b.teamId,
      teamName: b.teamName,
      wager: b.wager,
      isGhost: b.isGhost,
      auto: b.auto,
      result: b.result,
      gameId: b.gameId,
    })),
    games,
  });
  const notices = [
    ...customTicker.map((t) => ({ kind: t.color, text: t.text }) as const),
    ...computedNotices,
  ];

  const mine = ctx.picks.find((p) => p.week === weekNumber);

  return (
    <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <Image src={BRAND.logoOnDark} alt={BRAND.name} width={200} height={134} className="h-auto w-20" priority />
        <div className="flex items-center gap-5 text-sm">
          <div className="text-right">
            <p className="font-semibold">
              {user.first_name} {user.last_name}
              {isGhost && <span className="ml-2 text-xs text-loss">{VOCAB.eliminated}</span>}
            </p>
            <p className="text-ink-muted">
              {myRow && !isGhost ? (
                <>
                  #{myRow.rank} · <span className="num text-gold">{myRow.bankroll}</span> pts
                </>
              ) : isGhost ? (
                "playing for pride"
              ) : (
                "—"
              )}
            </p>
          </div>
          <nav className="flex flex-col items-end gap-1 text-xs text-ink-muted">
            {user.role === "admin" && (
              <Link href="/admin" className="text-gold hover:text-gold-bright">
                Commissioner
              </Link>
            )}
            <Link href="/how-to-play" className="hover:text-ink">How to play</Link>
            <SignOutButton>
              <button className="hover:text-ink">Log out</button>
            </SignOutButton>
          </nav>
        </div>
      </header>

      {/* Section nav */}
      <nav className="section-nav sticky top-0 z-20 -mx-4 mb-5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-4 py-2.5 text-xs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 uppercase tracking-wide text-ink-muted transition hover:text-gold">
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Notices ticker */}
      <div className="mb-5">
        <NoticesTicker notices={notices} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* The money spot: ante form pre-reveal, the flipped board after */}
        <div id="week" className="scroll-mt-16">
          {week ? (
            revealed && board ? (
              <RevealBoard
                week={weekNumber}
                rows={board}
                meId={user.id}
                settled={week.state === "settled"}
              />
            ) : (
              <AnteCard
                week={weekNumber}
                lockAtIso={week.lock_at}
                lockSource={week.lock_source}
                bankroll={ctx.bankroll ?? 0}
                teams={eligible}
                myPick={mine ? { teamId: mine.team_id, wager: mine.wager } : null}
                isGhost={isGhost}
              />
            )
          ) : (
            <section className="panel p-6">
              <p className="text-ink-muted">Season setup in progress — check back soon.</p>
            </section>
          )}
        </div>

        {/* The Table */}
        <div id="table" className="scroll-mt-16">
          <TheTable
            rows={table.map((r) => ({ ...r, anted: anted.has(r.userId) }))}
            meId={user.id}
            preReveal={!revealed}
          />
        </div>

        {/* Team inventory */}
        <div id="teams" className="scroll-mt-16">
          <TeamInventory teams={inventory} schedule={schedule} currentWeek={weekNumber} />
        </div>

        {/* Table Talk */}
        <div id="talk" className="scroll-mt-16">
          <TableTalk initial={chat} meId={user.id} muted={Boolean(user.muted_at)} />
        </div>
      </div>

      {/* Below the fold */}
      <div className="mt-5 space-y-5">
        <div id="schedule" className="scroll-mt-16">
          <SchedulePanel schedule={schedule} currentWeek={weekNumber} />
        </div>
        <div id="history" className="scroll-mt-16">
          <HistoryPanel weeks={history} />
        </div>
        <div id="stats" className="scroll-mt-16">
          <StatsPanels
            weekly={weeklySuperlatives(stats)}
            season={seasonRecords(stats)}
            lastSettledWeek={stats.lastSettledWeek}
          />
        </div>
      </div>

      <footer className="mt-8 pb-4 text-center text-[11px] text-ink-muted/60">
        {BRAND.name} — free league · title &amp; bragging rights · play smart
      </footer>
    </main>
  );
}
