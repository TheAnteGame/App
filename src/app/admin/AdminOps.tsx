"use client";

import { useActionState, useState, useTransition } from "react";
import {
  overrideLock,
  correctResult,
  runLockNow,
  runSettleNow,
  seatSelf,
  type ActionResult,
} from "./actions";

/** Client-side commissioner controls: job runs, lock override, result correction. */

function ResultLine({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <p className={`mt-2 text-xs ${r.ok ? "text-win" : "text-loss"}`}>{r.message}</p>;
}

export function JobButtons() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) => () =>
    start(async () => setResult(await fn()));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={run(() => runLockNow())}
          disabled={pending}
          className="display rounded-lg bg-gold px-3.5 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright disabled:opacity-40"
        >
          Lock &amp; reveal now
        </button>
        <button
          onClick={run(() => runSettleNow(true))}
          disabled={pending}
          className="rounded-lg border border-win/50 px-3.5 py-2 text-sm text-win hover:bg-win/10 disabled:opacity-40"
        >
          Refresh scores + settle
        </button>
        <button
          onClick={run(() => runSettleNow(false))}
          disabled={pending}
          className="rounded-lg border border-edge px-3.5 py-2 text-sm text-ink-muted hover:border-gold hover:text-ink disabled:opacity-40"
          title="Settle without pulling ESPN — use after a manual result correction"
        >
          Settle as-entered
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted">
        All three are idempotent — safe to press twice. &quot;Settle as-entered&quot; skips the ESPN
        refresh so a hand-corrected result isn&apos;t overwritten.
      </p>
      {pending && <p className="mt-2 text-xs text-gold">Running…</p>}
      <ResultLine r={result} />
    </div>
  );
}

export function SeatSelfButton() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 border-t border-edge/60 pt-3">
      <button
        onClick={() => start(async () => setResult(await seatSelf()))}
        disabled={pending}
        className="rounded-lg border border-gold/50 px-3.5 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-40"
      >
        Take your own seat at the table
      </button>
      <p className="mt-1 text-[11px] text-ink-muted">
        Your admin account has no league seat yet — without one you can&apos;t ante or talk.
        This deals you in with the standard 1,000 stack.
      </p>
      <ResultLine r={result} />
    </div>
  );
}

export function LockOverrideForm({ weeks }: { weeks: { week: number; state: string }[] }) {
  const [result, action, pending] = useActionState(overrideLock, null);
  const upcoming = weeks.filter((w) => w.state === "upcoming");
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Week
        <select name="week" required className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold">
          {upcoming.map((w) => (
            <option key={w.week} value={w.week}>
              Week {w.week}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        New lock (ET)
        <input
          name="lockAtEt"
          type="datetime-local"
          required
          className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-ink-muted">
        Reason (audit-logged)
        <input
          name="reason"
          required
          placeholder="e.g. Thursday game moved"
          className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-gold/50 px-3.5 py-2 text-sm text-gold hover:bg-gold/10 disabled:opacity-40"
      >
        Override lock
      </button>
      <div className="w-full">
        <ResultLine r={result} />
      </div>
    </form>
  );
}

export type CorrectableGame = {
  id: string;
  week: number;
  label: string; // "NE @ SEA"
  homeAbbr: string;
  awayAbbr: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export function ResultCorrectionForm({ games }: { games: CorrectableGame[] }) {
  const [result, action, pending] = useActionState(correctResult, null);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const game = games.find((g) => g.id === gameId);
  if (games.length === 0)
    return <p className="text-sm text-ink-muted">No games in a correctable window right now.</p>;
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-col gap-1 text-xs text-ink-muted">
          Game
          <select
            name="gameId"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                W{g.week} · {g.label} ({g.status}
                {g.homeScore !== null ? ` ${g.awayScore}–${g.homeScore}` : ""})
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs text-ink-muted">
          {game?.awayAbbr ?? "Away"}
          <input name="awayScore" type="number" min={0} defaultValue={game?.awayScore ?? 0} className="num rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold" />
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs text-ink-muted">
          {game?.homeAbbr ?? "Home"}
          <input name="homeScore" type="number" min={0} defaultValue={game?.homeScore ?? 0} className="num rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Outcome
          <select name="outcome" className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold">
            <option value="home">{game ? `${game.homeAbbr} won` : "Home won"}</option>
            <option value="away">{game ? `${game.awayAbbr} won` : "Away won"}</option>
            <option value="tie">Official tie</option>
            <option value="not_final">Not final (reopen)</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-ink-muted">
          Reason (audit-logged, required)
          <input name="reason" required placeholder="e.g. ESPN outage — result from NFL.com" className="rounded-lg border border-edge bg-surface-raised px-2.5 py-2 text-sm text-ink outline-none focus:border-gold" />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg border border-loss/50 px-3.5 py-2 text-sm text-loss hover:bg-loss/10 disabled:opacity-40">
          Correct result
        </button>
      </div>
      <p className="text-[11px] text-ink-muted">
        Original values are preserved in the audit log. After correcting, press
        &quot;Settle as-entered&quot; above so the correction isn&apos;t overwritten by ESPN.
      </p>
      <ResultLine r={result} />
    </form>
  );
}
