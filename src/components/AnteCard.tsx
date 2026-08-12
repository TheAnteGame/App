"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { anteUp, type AnteFormState } from "@/app/dashboard/actions";
import { VOCAB } from "@/lib/brand";
import { WAGER_MAX, WAGER_MIN } from "@/lib/constants";

export type EligibleTeam = {
  teamId: number;
  abbr: string;
  name: string;
  eligible: boolean;
  reason: string;
  uses: number;
};

type Props = {
  week: number;
  lockAtIso: string;
  lockSource: string;
  bankroll: number;
  teams: EligibleTeam[];
  myPick: { teamId: number; wager: number } | null;
  isGhost: boolean;
};

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s` };
}

export default function AnteCard({
  week,
  lockAtIso,
  lockSource,
  bankroll,
  teams,
  myPick,
  isGhost,
}: Props) {
  const [state, formAction, pending] = useActionState<AnteFormState, FormData>(
    anteUp,
    { error: null, ok: false },
  );
  const [editing, setEditing] = useState(!myPick);
  const [teamId, setTeamId] = useState<number | "">(myPick?.teamId ?? "");
  const [wager, setWager] = useState<number>(myPick?.wager ?? Math.min(100, bankroll));
  const { ms, label } = useCountdown(lockAtIso);

  const effectiveBankroll = isGhost ? 1000 : bankroll;
  const forcedAllIn = !isGhost && bankroll > 0 && bankroll < WAGER_MIN;
  const lockDate = useMemo(() => new Date(lockAtIso), [lockAtIso]);
  const lockLabel = lockDate.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  const chosen = teams.find((t) => t.teamId === teamId);
  const showForm = editing && ms > 0;

  return (
    <section className="rounded-2xl border border-gold/25 bg-surface-card/70 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="display text-xl font-bold uppercase">Week {week}</h2>
        <div className="text-right">
          <p className="num text-lg font-semibold text-gold">{ms > 0 ? label : "LOCKED"}</p>
          <p className="text-xs text-ink-muted">
            {VOCAB.deadline(lockLabel)}
            {lockSource === "early_game" && " (early game week)"}
          </p>
        </div>
      </div>

      {isGhost && (
        <p className="mb-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
          BUSTED — you&apos;re playing for bragging rights. Shadow antes only.
        </p>
      )}

      {!showForm && myPick && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{VOCAB.submitted}:</p>
          <div className="flex items-center justify-between rounded-xl border border-edge bg-surface-raised px-4 py-3">
            <span className="display text-lg font-bold">
              {teams.find((t) => t.teamId === myPick.teamId)?.name ?? "—"}
            </span>
            <span className="num text-lg font-semibold text-gold">{myPick.wager}</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-win">
              Win → <span className="num">{effectiveBankroll + myPick.wager}</span>
            </span>
            <span className="text-loss">
              Lose → <span className="num">{effectiveBankroll - myPick.wager}</span>
            </span>
          </div>
          {ms > 0 && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-gold underline-offset-2 hover:underline"
            >
              Edit until reveal
            </button>
          )}
        </div>
      )}

      {!showForm && !myPick && ms <= 0 && (
        <p className="text-sm text-ink-muted">
          No ante this week — the house anted for you. <span className="text-gold">AUTO-ANTE</span> details at reveal.
        </p>
      )}

      {showForm && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="week" value={week} />
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
              Your team — to win outright
            </label>
            <select
              name="teamId"
              required
              value={teamId}
              onChange={(e) => setTeamId(Number(e.target.value))}
              className="w-full rounded-xl border border-edge bg-surface-raised px-4 py-3 text-ink outline-none focus:border-gold"
            >
              <option value="" disabled>
                Pick your winner…
              </option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId} disabled={!t.eligible}>
                  {t.name} ({t.uses}/2)
                  {!t.eligible &&
                    ` — ${{ bye: "bye", used_max: "used up", used_last_week: "last week", ok: "" }[t.reason as "bye"] ?? t.reason}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-ink-muted">
              Your ante ({forcedAllIn ? `all-in: ${bankroll}` : `${WAGER_MIN}–${Math.min(WAGER_MAX, effectiveBankroll)}`})
            </label>
            <input
              name="wager"
              type="number"
              required
              min={forcedAllIn ? bankroll : WAGER_MIN}
              max={forcedAllIn ? bankroll : Math.min(WAGER_MAX, effectiveBankroll)}
              step={1}
              value={forcedAllIn ? bankroll : wager}
              onChange={(e) => setWager(Number(e.target.value))}
              readOnly={forcedAllIn}
              className="num w-full rounded-xl border border-edge bg-surface-raised px-4 py-3 text-lg text-ink outline-none focus:border-gold"
            />
          </div>

          {chosen && Number.isFinite(wager) && (
            <div className="flex gap-4 text-sm">
              <span className="text-win">
                Win → <span className="num">{effectiveBankroll + (forcedAllIn ? bankroll : wager)}</span>
              </span>
              <span className="text-loss">
                Lose → <span className="num">{effectiveBankroll - (forcedAllIn ? bankroll : wager)}</span>
              </span>
            </div>
          )}

          {state.error && <p className="text-sm text-loss">{state.error}</p>}

          <button
            type="submit"
            disabled={pending || !teamId}
            className="display w-full rounded-xl bg-gold px-4 py-4 text-xl font-bold uppercase text-surface transition hover:bg-gold-bright disabled:opacity-40"
          >
            {pending ? "Sliding it in…" : VOCAB.submit}
          </button>
        </form>
      )}
    </section>
  );
}
