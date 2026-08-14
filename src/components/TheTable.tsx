"use client";

import { useState } from "react";
import { VOCAB } from "@/lib/brand";

/**
 * The Table (docs/01 Page 4): leaderboard with sortable stat views, rank
 * movement vs last snapshot, anted/waiting status pre-reveal (never picks),
 * and BUSTED ghosts memorialized at the bottom.
 */

export type TableRow = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  eliminated: boolean;
  bankroll: number;
  rank: number;
  wins: number;
  losses: number;
  pushes: number;
  biggestWin: number;
  avgAnte: number;
  autos: number;
  prevRank: number | null;
  anted: boolean;
};

const VIEWS = [
  { key: "stack", label: "Stack" },
  { key: "record", label: "W-L" },
  { key: "biggest", label: "Big win" },
  { key: "risk", label: "Risk" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function Movement({ r }: { r: TableRow }) {
  if (r.prevRank === null || r.prevRank === r.rank) return null;
  const up = r.prevRank > r.rank;
  return (
    <span className={`ml-1.5 text-[10px] ${up ? "text-win" : "text-loss"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(r.prevRank - r.rank)}
    </span>
  );
}

export default function TheTable({
  rows,
  meId,
  preReveal,
}: {
  rows: TableRow[];
  meId: string;
  preReveal: boolean;
}) {
  const [view, setView] = useState<ViewKey>("stack");

  const alive = rows.filter((r) => !r.eliminated);
  const busted = rows.filter((r) => r.eliminated);

  const sorted = [...alive].sort((a, b) => {
    switch (view) {
      case "record":
        return b.wins - a.wins || a.losses - b.losses || b.bankroll - a.bankroll;
      case "biggest":
        return b.biggestWin - a.biggestWin || b.bankroll - a.bankroll;
      case "risk":
        return b.avgAnte - a.avgAnte || b.bankroll - a.bankroll;
      default:
        return a.rank - b.rank;
    }
  });

  const metric = (r: TableRow) => {
    switch (view) {
      case "record":
        return (
          <span className="num">
            {r.wins}-{r.losses}
            {r.pushes > 0 && <span className="text-ink-muted">-{r.pushes}</span>}
          </span>
        );
      case "biggest":
        return <span className="num text-win">{r.biggestWin > 0 ? `+${r.biggestWin}` : "—"}</span>;
      case "risk":
        return <span className="num text-gold">{r.avgAnte > 0 ? r.avgAnte : "—"}</span>;
      default:
        return <span className="num font-semibold">{r.bankroll}</span>;
    }
  };

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="display text-xl font-bold uppercase">{VOCAB.leaderboard}</h2>
        <div className="flex rounded-lg border border-edge bg-surface-raised p-0.5 text-[11px]">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-md px-2 py-1 transition ${
                view === v.key ? "bg-gold text-surface font-semibold" : "text-ink-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {sorted.length === 0 && <p className="text-sm text-ink-muted">Seats are filling…</p>}
        {sorted.map((r, i) => (
          <div
            key={r.userId}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              r.userId === meId ? "bg-gold/10 ring-1 ring-gold/25" : "odd:bg-surface-raised/40"
            }`}
          >
            <span className="flex min-w-0 items-center">
              <span className="num mr-3 inline-block w-6 shrink-0 text-ink-muted">
                #{view === "stack" ? r.rank : i + 1}
              </span>
              <span className="truncate">
                {r.firstName} {r.lastName?.[0]}.
              </span>
              {view === "stack" && <Movement r={r} />}
              {preReveal && (
                <span
                  className={`ml-2 shrink-0 text-[10px] ${r.anted ? "text-win" : "text-ink-muted/60"}`}
                  title={r.anted ? "Ante's in" : "Hasn't anted yet"}
                >
                  {r.anted ? "✓ anted" : "…waiting"}
                </span>
              )}
            </span>
            {metric(r)}
          </div>
        ))}

        {busted.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-ink-muted/70">
              The rail — busted, never forgotten
            </p>
            {busted.map((r) => (
              <div
                key={r.userId}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm opacity-55 ${
                  r.userId === meId ? "bg-gold/10" : ""
                }`}
              >
                <span>
                  <span className="mr-2 text-[10px]">🪦</span>
                  {r.firstName} {r.lastName?.[0]}.
                  <span className="ml-2 text-[10px] font-bold text-loss">{VOCAB.eliminated}</span>
                  {preReveal && r.anted && (
                    <span className="ml-2 text-[10px] text-ink-muted">✓ shadow ante in</span>
                  )}
                </span>
                <span className="num">
                  {r.wins}-{r.losses}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
