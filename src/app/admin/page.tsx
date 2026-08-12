import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, approveUser } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Admin panel v1 (spec §11): approvals + submission status + week states. */
export default async function Admin() {
  const user = await requireUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const db = supabaseAdmin();
  const [{ data: pending }, { data: players }, { data: weeks }, { data: picksThisSeason }] =
    await Promise.all([
      db.from("users").select("*").eq("status", "pending").order("created_at"),
      db.from("users").select("*").neq("status", "pending").order("created_at"),
      db
        .from("weeks")
        .select("*")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON)
        .order("week"),
      db
        .from("picks")
        .select("user_id, week, state, pick_type, is_ghost")
        .eq("league_id", BETA_LEAGUE_ID)
        .eq("season", SEASON),
    ]);

  async function approve(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!actor || actor.role !== "admin") return;
    await approveUser(String(formData.get("userId")), actor.id);
    revalidatePath("/admin");
  }

  async function decline(formData: FormData) {
    "use server";
    const actor = await requireUser();
    if (!actor || actor.role !== "admin") return;
    const userId = String(formData.get("userId"));
    const dbi = supabaseAdmin();
    const { data: before } = await dbi.from("users").select("*").eq("id", userId).single();
    if (!before || before.status !== "pending") return; // decline applies to pending seats only
    await dbi.from("users").update({ status: "removed" }).eq("id", userId);
    await dbi.from("audit_log").insert({
      actor_user_id: actor.id,
      action: "decline_user",
      entity: "users",
      entity_id: userId,
      before,
      after: { ...before, status: "removed" },
      reason: "Commissioner declined the seat request",
    });
    revalidatePath("/admin");
  }

  const currentWeek = (weeks ?? []).find((w) =>
    ["upcoming", "revealed"].includes(w.state),
  );
  const submittedThisWeek = new Set(
    (picksThisSeason ?? [])
      .filter((p) => p.week === currentWeek?.week && !p.is_ghost)
      .map((p) => p.user_id),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="display text-3xl font-bold uppercase">Commissioner</h1>
        <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
          ← The table
        </Link>
      </header>

      <section className="mb-10">
        <h2 className="display mb-4 text-xl font-semibold uppercase">
          Waiting for a seat ({pending?.length ?? 0})
        </h2>
        {(pending ?? []).length === 0 && (
          <p className="text-sm text-ink-muted">Nobody in line.</p>
        )}
        <div className="space-y-2">
          {(pending ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface-card/70 px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {p.first_name ?? "—"} {p.last_name ?? ""}
                </p>
                <p className="text-xs text-ink-muted">{p.email} · {p.phone ?? "no phone"}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${p.email}?subject=${encodeURIComponent("Your seat at The Ante")}`}
                  className="rounded-lg border border-edge px-3 py-2 text-sm text-ink-muted hover:border-gold hover:text-ink"
                >
                  Email
                </a>
                <form action={decline}>
                  <input type="hidden" name="userId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-loss/50 px-3 py-2 text-sm text-loss hover:bg-loss/10"
                  >
                    Decline
                  </button>
                </form>
                <form action={approve}>
                  <input type="hidden" name="userId" value={p.id} />
                  <button
                    type="submit"
                    className="display rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright"
                  >
                    Give them a seat
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="display mb-4 text-xl font-semibold uppercase">
          Players ({players?.length ?? 0})
          {currentWeek && (
            <span className="ml-3 text-sm font-normal normal-case text-ink-muted">
              Right column = Week {currentWeek.week} ante status (names only pre-reveal, never picks)
            </span>
          )}
        </h2>
        <div className="space-y-1">
          {(players ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm odd:bg-surface-raised/50"
            >
              <span>
                {p.first_name} {p.last_name}
                <span className="ml-2 text-xs text-ink-muted">{p.email}</span>
                {p.role === "admin" && <span className="ml-2 text-xs text-gold">COMMISH</span>}
                {p.status === "eliminated" && <span className="ml-2 text-xs text-loss">BUSTED</span>}
                {p.status === "removed" && <span className="ml-2 text-xs text-ink-muted">removed</span>}
              </span>
              {currentWeek && p.status === "active" && (
                <span className={submittedThisWeek.has(p.id) ? "text-win" : "text-ink-muted"}>
                  {submittedThisWeek.has(p.id) ? "✓ anted" : "no ante yet"}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="display mb-4 text-xl font-semibold uppercase">Weeks</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(weeks ?? []).map((w) => (
            <div key={w.id} className="rounded-lg border border-edge bg-surface-card/60 px-3 py-2 text-sm">
              <p className="font-medium">
                Week {w.week}
                {w.lock_source === "early_game" && (
                  <span className="ml-1 text-xs text-gold">early</span>
                )}
              </p>
              <p className="text-xs text-ink-muted">
                {w.state} · locks{" "}
                {new Date(w.lock_at).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                ET
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
