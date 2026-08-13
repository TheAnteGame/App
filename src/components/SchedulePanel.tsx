"use client";

import { useState } from "react";
import type { ScheduleGame } from "@/components/TeamInventory";

/** NFL schedule, weeks 1–18, viewer-local kickoff times (docs/01 Page 4). */
export default function SchedulePanel({
  schedule,
  currentWeek,
}: {
  schedule: ScheduleGame[];
  currentWeek: number;
}) {
  const [week, setWeek] = useState(currentWeek);
  const games = schedule.filter((g) => g.week === week);

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-xl font-bold uppercase">NFL schedule</h2>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`num shrink-0 rounded-md px-2 py-1 text-xs transition ${
                week === w
                  ? "bg-gold font-bold text-surface"
                  : w === currentWeek
                    ? "border border-gold/40 text-gold"
                    : "border border-edge text-ink-muted hover:text-ink"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5 md:grid-cols-2">
        {games.map((g) => {
          const final = g.status === "final";
          const live = g.status === "in_progress";
          const homeWon = final && g.winnerTeamId === g.homeTeamId;
          const awayWon = final && g.winnerTeamId === g.awayTeamId;
          return (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-edge/60 bg-surface-raised/50 px-3.5 py-2.5 text-sm"
            >
              <span>
                <span className={awayWon ? "font-semibold text-win" : ""}>{g.awayName}</span>
                <span className="mx-1.5 text-ink-muted">@</span>
                <span className={homeWon ? "font-semibold text-win" : ""}>{g.homeName}</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                {live && <span className="live-dot" aria-hidden="true" />}
                {final || live ? (
                  <span className="num">
                    {g.awayScore ?? 0}–{g.homeScore ?? 0}
                    {final ? " F" : ""}
                  </span>
                ) : g.status === "postponed" || g.status === "canceled" ? (
                  g.status
                ) : (
                  new Date(g.kickoffAt).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                )}
              </span>
            </div>
          );
        })}
        {games.length === 0 && (
          <p className="text-sm text-ink-muted">No games synced for week {week} yet.</p>
        )}
      </div>
    </section>
  );
}
