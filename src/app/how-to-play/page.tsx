import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { requireUser, standings } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getContent } from "@/lib/content";

/**
 * Page 3 — How to Play (wireframe 3): short instructions, detailed rules
 * (distilled from docs/02-GAME_RULES.md, the canonical source), legal notices,
 * live registered-player rail, and the one-time timestamped Accept gate.
 */
export default async function HowToPlay() {
  const user = await requireUser();
  if (!user) redirect("/");
  const [players, c] = await Promise.all([standings(), getContent()]);
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
            <h1 className="display mb-4 text-3xl font-bold uppercase">{c["howto.title1"]}</h1>
            <div className="rich" dangerouslySetInnerHTML={{ __html: c["howto.section1Html"] }} />
          </section>

          <section>
            <h2 className="display mb-4 text-2xl font-bold uppercase">{c["howto.title2"]}</h2>
            <div className="rich text-sm" dangerouslySetInnerHTML={{ __html: c["howto.section2Html"] }} />
          </section>

          <section>
            <h2 className="display mb-4 text-2xl font-bold uppercase">{c["howto.title3"]}</h2>
            <div className="rich text-xs opacity-90" dangerouslySetInnerHTML={{ __html: c["howto.section3Html"] }} />
          </section>

          {!accepted && (
            <form action={accept}>
              <button
                type="submit"
                className="display w-full rounded-xl bg-gold px-4 py-4 text-lg font-bold uppercase text-surface transition hover:bg-gold-bright sm:w-auto sm:px-10"
              >
                {c["howto.acceptButton"]}
              </button>
              <p className="mt-2 text-xs text-ink-muted/70">
                {c["howto.acceptNote"]}
              </p>
            </form>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-edge bg-surface-card/60 p-5">
          <h3 className="display mb-3 text-lg font-semibold uppercase">{c["howto.railTitle"]}</h3>
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
