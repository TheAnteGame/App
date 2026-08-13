"use client";

import { useState } from "react";
import { VOCAB } from "@/lib/brand";
import type { BoardRow } from "@/lib/board";

export type HistoryWeek = {
  week: number;
  rows: BoardRow[];
  /** post-week rank + bankroll snapshot */
  standings: { userId: string; name: string; rank: number; bankroll: number }[];
};

/** Week history (docs/01 Page 4): any past week's picks, results, deltas, ranks. */
export default function HistoryPanel({ weeks }: { weeks: HistoryWeek[] }) {
  const [openWeek, setOpenWeek] = useState<number | null>(
    weeks.length > 0 ? weeks[weeks.length - 1].week : null,
  );
  if (weeks.length === 0) {
    return (
      <section className="panel p-5 sm:p-6">
        <h2 className="display mb-2 text-xl font-bold uppercase">Week history</h2>
        <p className="text-sm text-ink-muted">
          Nothing in the books yet — history starts once Week 1 settles.
        </p>
      </section>
    );
  }
  const current = weeks.find((w) => w.week === openWeek) ?? weeks[weeks.length - 1];

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-xl font-bold uppercase">Week history</h2>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {weeks.map((w) => (
            <button
              key={w.week}
              onClick={() => setOpenWeek(w.week)}
              className={`num shrink-0 rounded-md px-2 py-1 text-xs transition ${
                current.week === w.week
                  ? "bg-gold font-bold text-surface"
                  : "border border-edge text-ink-muted hover:text-ink"
              }`}
            >
              {w.week}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-1.5">
          {current.rows.map((r) => (
            <div
              key={r.pickId}
              className={`flex items-center justify-between rounded-lg border border-edge/50 px-3.5 py-2 text-sm ${
                r.isGhost ? "opacity-50" : "bg-surface-raised/40"
              }`}
            >
              <span className="min-w-0 truncate">
                {r.firstName} {r.lastName?.[0]}.
                {r.auto && (
                  <span className="ml-2 rounded bg-brand-purple/25 px-1 py-0.5 text-[9px] font-bold text-gold-bright">
                    {VOCAB.autoPick}
                  </span>
                )}
                {r.isGhost && <span className="ml-2 text-[9px] font-bold text-loss">{VOCAB.eliminated}</span>}
                <span className="ml-2 text-xs text-ink-muted">{r.teamName}</span>
              </span>
              <span className="num shrink-0">
                {r.result === "win" && <span className="text-win">+{r.wager}</span>}
                {r.result === "loss" && <span className="text-loss">−{r.wager}</span>}
                {(r.result === "push" || r.result === "void") && (
                  <span className="text-ink-muted">{r.result.toUpperCase()}</span>
                )}
                {!r.result && <span className="text-ink-muted">{r.wager}</span>}
              </span>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-ink-muted/70">
            After week {current.week}
          </p>
          <div className="space-y-1">
            {current.standings.map((s) => (
              <div
                key={s.userId}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm odd:bg-surface-raised/40"
              >
                <span>
                  <span className="num mr-2.5 text-ink-muted">#{s.rank}</span>
                  {s.name}
                </span>
                <span className="num">{s.bankroll}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
