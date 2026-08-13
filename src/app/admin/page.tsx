import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { VOCAB } from "@/lib/brand";
import { approve, decline, toggleMute, deleteChatMessage } from "./actions";
import {
  JobButtons,
  LockOverrideForm,
  ResultCorrectionForm,
  SeatSelfButton,
  type CorrectableGame,
} from "./AdminOps";

export const dynamic = "force-dynamic";

const ET: Intl.DateTimeFormatOptions = {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Commissioner console (spec §11), Phase 2: approvals, CRM, week ops (lock
 * override + job runs), result correction w/ audit trail, AUTO-ANTE review,
 * Table Talk moderation, audit log. Exit criterion: run a whole week from
 * here without touching the database.
 */
export default async function Admin() {
  const user = await requireUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const db = supabaseAdmin();
  const [
    { data: pending },
    { data: players },
    { data: weeks },
    { data: picksThisSeason },
    { data: members },
    { data: chat },
    { data: auditRows },
    { data: teams },
  ] = await Promise.all([
    db.from("users").select("*").eq("status", "pending").order("created_at"),
    db.from("users").select("*").neq("status", "pending").order("created_at"),
    db.from("weeks").select("*").eq("league_id", BETA_LEAGUE_ID).eq("season", SEASON).order("week"),
    db
      .from("picks")
      .select("id, user_id, week, state, pick_type, is_ghost, team_id, wager")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON),
    db.from("league_members").select("user_id, bankroll").eq("league_id", BETA_LEAGUE_ID),
    db
      .from("chat_messages")
      .select("*")
      .eq("league_id", BETA_LEAGUE_ID)
      .order("created_at", { ascending: false })
      .limit(25),
    db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(25),
    db.from("nfl_teams").select("id, abbr, name"),
  ]);

  const currentWeek = (weeks ?? []).find((w) => ["upcoming", "revealed"].includes(w.state));
  const revealed = Boolean(currentWeek?.revealed_at);
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const nameById = new Map(
    (players ?? []).map((p) => [p.id, `${p.first_name ?? "?"} ${p.last_name ?? ""}`.trim()]),
  );
  const bankrollById = new Map((members ?? []).map((m) => [m.user_id, m.bankroll]));

  const submittedThisWeek = new Set(
    (picksThisSeason ?? [])
      .filter((p) => p.week === currentWeek?.week && !p.is_ghost)
      .map((p) => p.user_id),
  );

  // AUTO-ANTE review: auto picks only exist post-lock, so they're post-reveal
  // by construction — never a privacy leak.
  const autoPicks = (picksThisSeason ?? [])
    .filter((p) => p.pick_type === "auto")
    .sort((a, b) => b.week - a.week);

  // Correctable games: current + revealed weeks, not yet fully settled.
  const correctableWeeks = new Set(
    (weeks ?? []).filter((w) => ["upcoming", "revealed"].includes(w.state)).map((w) => w.week),
  );
  const { data: gamesRaw } = await db
    .from("nfl_games")
    .select("*")
    .eq("season", SEASON)
    .in("week", [...correctableWeeks].length ? [...correctableWeeks] : [0])
    .order("kickoff_at");
  const correctable: CorrectableGame[] = (gamesRaw ?? []).map((g) => ({
    id: g.id,
    week: g.week,
    label: `${teamById.get(g.away_team_id)?.abbr ?? "?"} @ ${teamById.get(g.home_team_id)?.abbr ?? "?"}`,
    homeAbbr: teamById.get(g.home_team_id)?.abbr ?? "?",
    awayAbbr: teamById.get(g.away_team_id)?.abbr ?? "?",
    status: g.status,
    homeScore: g.home_score,
    awayScore: g.away_score,
  }));

  // Season W-L per player for the CRM
  const record = new Map<string, { w: number; l: number }>();
  for (const p of picksThisSeason ?? []) {
    if (p.is_ghost || p.state !== "settled") continue;
    const r = record.get(p.user_id) ?? { w: 0, l: 0 };
    record.set(p.user_id, r);
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="display text-3xl font-bold uppercase">Commissioner</h1>
        <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
          ← The table
        </Link>
      </header>

      {/* ---- This week: state + one-button ops ---- */}
      <section className="panel mb-6 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl font-semibold uppercase">
            {currentWeek ? `Week ${currentWeek.week} — ${currentWeek.state}` : "Season complete"}
          </h2>
          {currentWeek && (
            <p className="text-xs text-ink-muted">
              Locks {new Date(currentWeek.lock_at).toLocaleString("en-US", ET)} ET
              {currentWeek.lock_source === "early_game" && " (early game)"}
              {currentWeek.lock_source === "admin_override" && " (overridden)"}
              {" · "}
              {revealed
                ? "board is public"
                : `${submittedThisWeek.size} ante(s) in — names only until reveal`}
            </p>
          )}
        </div>
        <JobButtons />
        {!bankrollById.has(user.id) && <SeatSelfButton />}
      </section>

      {/* ---- Pending seats ---- */}
      <section className="mb-6">
        <h2 className="display mb-3 text-xl font-semibold uppercase">
          Waiting for a seat ({pending?.length ?? 0})
        </h2>
        {(pending ?? []).length === 0 && <p className="text-sm text-ink-muted">Nobody in line.</p>}
        <div className="space-y-2">
          {(pending ?? []).map((p) => (
            <div key={p.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">
                  {p.first_name ?? "—"} {p.last_name ?? ""}
                </p>
                <p className="text-xs text-ink-muted">
                  {p.email} · {p.phone ?? "no phone"}
                </p>
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
                  <button type="submit" className="rounded-lg border border-loss/50 px-3 py-2 text-sm text-loss hover:bg-loss/10">
                    Decline
                  </button>
                </form>
                <form action={approve}>
                  <input type="hidden" name="userId" value={p.id} />
                  <button type="submit" className="display rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright">
                    Give them a seat
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Week ops: lock override + result correction ---- */}
      <section className="panel mb-6 p-5">
        <h2 className="display mb-3 text-xl font-semibold uppercase">Lock override</h2>
        <LockOverrideForm weeks={(weeks ?? []).map((w) => ({ week: w.week, state: w.state }))} />
      </section>

      <section className="panel mb-6 p-5">
        <h2 className="display mb-3 text-xl font-semibold uppercase">Result correction</h2>
        <ResultCorrectionForm games={correctable} />
      </section>

      {/* ---- AUTO-ANTE review ---- */}
      <section className="mb-6">
        <h2 className="display mb-3 text-xl font-semibold uppercase">
          {VOCAB.autoPick} review ({autoPicks.length})
        </h2>
        {autoPicks.length === 0 && (
          <p className="text-sm text-ink-muted">No house antes dealt yet.</p>
        )}
        <div className="grid gap-1 sm:grid-cols-2">
          {autoPicks.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-edge/60 bg-surface-raised/40 px-3 py-2 text-sm">
              <span>
                <span className="num mr-2 text-ink-muted">W{p.week}</span>
                {nameById.get(p.user_id) ?? "?"}
                {p.is_ghost && <span className="ml-1.5 text-[10px] text-loss">{VOCAB.eliminated}</span>}
              </span>
              <span>
                <span className="display mr-2">{teamById.get(p.team_id)?.abbr ?? "?"}</span>
                <span className="num text-gold">{p.wager}</span>
                <span className="ml-2 text-xs text-ink-muted">{p.state}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Table Talk moderation ---- */}
      <section className="panel mb-6 p-5">
        <h2 className="display mb-3 text-xl font-semibold uppercase">{VOCAB.chat} moderation</h2>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {(chat ?? []).length === 0 && <p className="text-sm text-ink-muted">Quiet table.</p>}
          {(chat ?? []).map((m) => (
            <div
              key={m.id}
              className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                m.deleted_by_admin_at ? "opacity-40" : "odd:bg-surface-raised/40"
              }`}
            >
              <span className="min-w-0">
                <span className="mr-2 text-xs font-semibold text-ink-muted">
                  {nameById.get(m.user_id) ?? "?"}
                  <span className="ml-2 font-normal">
                    {new Date(m.created_at).toLocaleString("en-US", ET)} ET
                  </span>
                </span>
                <span className="break-words">{m.body}</span>
                {m.deleted_by_admin_at && <span className="ml-2 text-[10px] text-loss">removed</span>}
              </span>
              {!m.deleted_by_admin_at && (
                <form action={deleteChatMessage}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <button type="submit" className="shrink-0 text-xs text-loss hover:underline">
                    Remove
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- CRM ---- */}
      <section className="mb-6">
        <h2 className="display mb-3 text-xl font-semibold uppercase">
          Players ({(players ?? []).length})
          {currentWeek && !revealed && (
            <span className="ml-3 text-sm font-normal normal-case text-ink-muted">
              Ante column is names-only until reveal — never the pick
            </span>
          )}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-muted">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Stack</th>
                <th className="px-3 py-2">Wk {currentWeek?.week ?? "—"}</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Chat</th>
                <th className="px-3 py-2">Paid</th>
              </tr>
            </thead>
            <tbody>
              {(players ?? []).map((p) => (
                <tr key={p.id} className="odd:bg-surface-raised/40">
                  <td className="px-3 py-2 font-medium">
                    {p.first_name} {p.last_name}
                    {p.role === "admin" && <span className="ml-1.5 text-[10px] text-gold">COMMISH</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">
                    {p.email}
                    <br />
                    {p.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.status === "active" && <span className="text-win">active</span>}
                    {p.status === "eliminated" && <span className="text-loss">{VOCAB.eliminated}</span>}
                    {p.status === "removed" && <span className="text-ink-muted">removed</span>}
                  </td>
                  <td className="num px-3 py-2 text-right">{bankrollById.get(p.id) ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.status === "active" || p.status === "eliminated" ? (
                      submittedThisWeek.has(p.id) || (p.status === "eliminated" && submittedThisWeek.has(p.id)) ? (
                        <span className="text-win">✓ anted</span>
                      ) : (
                        <span className="text-ink-muted">waiting</span>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(p.status === "active" || p.status === "eliminated") && (
                      <form action={toggleMute}>
                        <input type="hidden" name="userId" value={p.id} />
                        <button
                          type="submit"
                          className={p.muted_at ? "text-loss hover:underline" : "text-ink-muted hover:text-ink hover:underline"}
                        >
                          {p.muted_at ? "muted — unmute" : "mute"}
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted/50">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[10px] text-ink-muted/60">
          &quot;Paid&quot; is a stub for the future paid tier — unused in the free beta.
        </p>
      </section>

      {/* ---- Weeks grid ---- */}
      <section className="mb-6">
        <h2 className="display mb-3 text-xl font-semibold uppercase">Weeks</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(weeks ?? []).map((w) => (
            <div key={w.id} className="rounded-lg border border-edge bg-surface-card/60 px-3 py-2 text-sm">
              <p className="font-medium">
                Week {w.week}
                {w.lock_source === "early_game" && <span className="ml-1 text-xs text-gold">early</span>}
                {w.lock_source === "admin_override" && <span className="ml-1 text-xs text-loss">override</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {w.state} · {new Date(w.lock_at).toLocaleString("en-US", ET)} ET
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Audit log ---- */}
      <section>
        <h2 className="display mb-3 text-xl font-semibold uppercase">Audit log</h2>
        <div className="space-y-1 text-xs">
          {(auditRows ?? []).length === 0 && (
            <p className="text-sm text-ink-muted">No admin actions logged yet.</p>
          )}
          {(auditRows ?? []).map((a) => (
            <div key={a.id} className="flex flex-wrap items-baseline gap-x-3 rounded-md px-3 py-1.5 odd:bg-surface-raised/40">
              <span className="text-ink-muted">{new Date(a.created_at).toLocaleString("en-US", ET)} ET</span>
              <span className="font-semibold text-gold">{a.action}</span>
              <span className="text-ink-muted">
                {a.entity} · {nameById.get(a.entity_id) ?? a.entity_id.slice(0, 8)}
              </span>
              {a.reason && <span className="text-ink-muted/80">— {a.reason}</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
