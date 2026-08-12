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
  standings,
  allTeams,
} from "@/lib/db";
import { eligibilityFor, toGameLite } from "@/lib/picks";
import { evaluateTeam } from "@/lib/engine/eligibility";
import AnteCard, { type EligibleTeam } from "@/components/AnteCard";

export const dynamic = "force-dynamic";

/** Page 4 — Player Dashboard (wireframe 4), v1: Ante card + The Table. */
export default async function Dashboard() {
  const user = await requireUser();
  if (!user) redirect("/");
  if (!profileComplete(user)) redirect("/welcome");

  // Pending: only How to Play + status (docs/01 page 2)
  if (user.status === "pending") {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="stage" aria-hidden="true">
          <div className="stage-blob stage-blob--gold" />
          <div className="stage-sweep" />
        </div>
        <div className="relative z-10 max-w-md">
          <Image src={BRAND.logoOnDark} alt={BRAND.name} width={400} height={268} className="mx-auto mb-8 h-auto w-44" priority />
          <h1 className="display mb-3 text-3xl font-bold uppercase">You&apos;re in line</h1>
          <p className="mb-8 text-ink-muted">
            The commissioner has your request. You&apos;ll get an email when
            {" "}{VOCAB.approved.toLowerCase()}.
          </p>
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
  const [gamesRaw, ctx, table, teams] = await Promise.all([
    week ? weekGames(week.week) : Promise.resolve([]),
    memberContext(user.id),
    standings(),
    allTeams(),
  ]);

  const games = gamesRaw.map(toGameLite);
  const isGhost = user.status === "eliminated";
  const myRow = table.find((r) => r.user_id === user.id);

  let card = null;
  if (week) {
    const input = eligibilityFor(week.week, games, ctx.picks);
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
    const mine = ctx.picks.find((p) => p.week === week.week);
    card = (
      <AnteCard
        week={week.week}
        lockAtIso={week.lock_at}
        lockSource={week.lock_source}
        bankroll={ctx.bankroll ?? 0}
        teams={eligible}
        myPick={mine ? { teamId: mine.team_id, wager: mine.wager } : null}
        isGhost={isGhost}
      />
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <Image src={BRAND.logoOnDark} alt={BRAND.name} width={200} height={134} className="h-auto w-20" priority />
        <div className="flex items-center gap-5 text-sm">
          <div className="text-right">
            <p className="font-semibold">
              {user.first_name} {user.last_name}
              {isGhost && <span className="ml-2 text-xs text-loss">BUSTED</span>}
            </p>
            <p className="text-ink-muted">
              {myRow ? (
                <>
                  #{myRow.rank} · <span className="num text-gold">{myRow.bankroll}</span> pts
                </>
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

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Weekly ante card */}
        <div>
          {card ?? (
            <section className="rounded-2xl border border-edge bg-surface-card/70 p-6">
              <p className="text-ink-muted">Season setup in progress — check back soon.</p>
            </section>
          )}
        </div>

        {/* The Table */}
        <section className="rounded-2xl border border-edge bg-surface-card/70 p-6">
          <h2 className="display mb-4 text-xl font-bold uppercase">{VOCAB.leaderboard}</h2>
          <div className="space-y-2">
            {table.length === 0 && (
              <p className="text-sm text-ink-muted">Seats are filling…</p>
            )}
            {table.map((r) => (
              <div
                key={r.user_id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  r.user_id === user.id ? "bg-gold/10" : ""
                } ${r.status === "eliminated" ? "opacity-50" : ""}`}
              >
                <span>
                  <span className="num mr-3 inline-block w-6 text-ink-muted">#{r.rank}</span>
                  {r.first_name} {r.last_name?.[0]}.
                  {r.status === "eliminated" && (
                    <span className="ml-2 text-[10px] text-loss">BUSTED</span>
                  )}
                </span>
                <span className="num font-semibold">{r.bankroll}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
