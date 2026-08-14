import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { requireUser, standings } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Page 3 — How to Play (wireframe 3): short instructions, detailed rules
 * (distilled from docs/02-GAME_RULES.md, the canonical source), legal notices,
 * live registered-player rail, and the one-time timestamped Accept gate.
 */
export default async function HowToPlay() {
  const user = await requireUser();
  if (!user) redirect("/");
  const players = await standings();
  const accepted = Boolean(user.rules_accepted_at);

  async function accept() {
    "use server";
    const u = await requireUser();
    if (!u || u.rules_accepted_at) return;
    await supabaseAdmin()
      .from("users")
      .update({ rules_accepted_at: new Date().toISOString() })
      .eq("id", u.id);
    redirect("/dashboard");
  }

  return (
    <main className="relative mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard">
          <Image src={BRAND.logoOnDark} alt={BRAND.name} width={200} height={134} className="h-auto w-24" />
        </Link>
        <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
          ← Back to the table
        </Link>
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_260px]">
        <div className="space-y-10">
          <section>
            <h1 className="display mb-4 text-3xl font-bold uppercase">How to Play</h1>
            <ol className="list-decimal space-y-2 pl-5 text-ink-muted">
              <li>Everyone starts the season with a <strong className="text-ink">1,000-point stack</strong>.</li>
              <li>Each week, pick <strong className="text-ink">one NFL team to win outright</strong> — no spreads, no props.</li>
              <li>Ante <strong className="text-ink">100–1,000 points</strong> on it (never more than your stack).</li>
              <li>Win: the ante is added to your stack. Lose: it&apos;s gone.</li>
              <li>Antes are due before the weekly lock. Miss it and the house antes for you: a random eligible team, 100 points — the <strong className="text-gold">AUTO-ANTE</strong>.</li>
              <li>Highest bankroll after Week 18 is the last stack standing.</li>
            </ol>
          </section>

          <section>
            <h2 className="display mb-4 text-2xl font-bold uppercase">Detailed Rules</h2>
            <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
              <p><strong className="text-ink">Team limits.</strong> Each team can be used at most twice per season, and never in back-to-back weeks. The team inventory shows every team as 0/2, 1/2, or 2/2 with ineligible teams disabled.</p>
              <p><strong className="text-ink">Lock &amp; reveal.</strong> Antes are due Thursday 3:00 PM Eastern — unless a game kicks off earlier that week, in which case the lock moves ahead of the first kickoff (the actual time is always shown). You can edit your pick until reveal. Reveal happens at lock, or the moment every active player is in — whichever comes first. Until then, nobody sees anyone else&apos;s pick or ante; after, everything flips face-up at once.</p>
              <p><strong className="text-ink">Short stacks.</strong> If your bankroll drops under 100, you must ante the whole thing. Win and you&apos;re rebuilding; lose and you&apos;re <strong className="text-loss">BUSTED</strong>.</p>
              <p><strong className="text-ink">Busting.</strong> A bankroll of zero eliminates you from title contention — no rebuys, no rescue points. Busted players stay at the table as ghosts: keep making picks for bragging rights, keep full access to chat and stats. Ghost picks never affect standings.</p>
              <p><strong className="text-ink">Results.</strong> Only official finals settle a wager. A tie is a push — no points move, but the team use still counts. Postponed games carry inside the same week; canceled games push with your ante restored.</p>
              <p><strong className="text-ink">Tiebreak.</strong> If first place is tied after Week 18, tied players go to Bankroll Overtime through the playoffs — one outright winner per round, distinct antes enforced, minimum ante drops to 1 so it always works. Still tied after the Super Bowl? The title is shared.</p>
            </div>
          </section>

          <section>
            <h2 className="display mb-4 text-2xl font-bold uppercase">Legal Notices</h2>
            <p className="text-xs leading-relaxed text-ink-muted/80">
              The Ante is a free-to-enter game of skill played for bragging
              rights. There is no entry fee, no buy-in, and no cash prize — no
              consideration is exchanged, and this league is not gambling under
              Arizona law. Placeholder notice: final language pending attorney
              review before any paid tier is ever considered.
            </p>
          </section>

          {!accepted && (
            <form action={accept}>
              <button
                type="submit"
                className="display w-full rounded-xl bg-gold px-4 py-4 text-lg font-bold uppercase text-surface transition hover:bg-gold-bright sm:w-auto sm:px-10"
              >
                I&apos;ve read it — deal me in
              </button>
              <p className="mt-2 text-xs text-ink-muted/70">
                Required once before your first pick. Your acceptance is timestamped.
              </p>
            </form>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-edge bg-surface-card/60 p-5">
          <h3 className="display mb-3 text-lg font-semibold uppercase">At the table</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {players.length === 0 && (
              <p className="text-sm text-ink-muted">Seats are filling…</p>
            )}
            {players.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between text-sm">
                <span className={p.status === "eliminated" ? "text-ink-muted line-through" : ""}>
                  {p.first_name} {p.last_name?.[0]}.
                </span>
                <span className="num text-ink-muted">{p.bankroll}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
