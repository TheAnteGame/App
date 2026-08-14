"use client";

import { useState } from "react";

/**
 * Team Inventory (docs/01 Page 4): all 32 teams with usage pips and disabled
 * states (used twice / last week's team / bye). Tapping a team opens its full
 * season schedule with results and the player's remaining uses.
 */

export type InventoryTeam = {
  teamId: number;
  abbr: string;
  name: string;
  usedWeeks: number[]; // weeks this player used the team
  eligible: boolean;
  reason: string; // ok | bye | used_max | used_last_week
};

export type ScheduleGame = {
  id: string;
  week: number;
  kickoffAt: string;
  status: string;
  homeAbbr: string;
  homeName: string;
  awayAbbr: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: number | null;
  homeTeamId: number;
  awayTeamId: number;
};

const REASON_LABEL: Record<string, string> = {
  bye: "Bye week",
  used_max: "Used twice — done for the season",
  used_last_week: "Rode them last week — no back-to-back",
};

export default function TeamInventory({
  teams,
  schedule,
  currentWeek,
}: {
  teams: InventoryTeam[];
  schedule: ScheduleGame[];
  currentWeek: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const openTeam = teams.find((t) => t.teamId === open);
  const teamGames = openTeam
    ? schedule
        .filter((g) => g.homeTeamId === openTeam.teamId || g.awayTeamId === openTeam.teamId)
        .sort((a, b) => a.week - b.week)
    : [];

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="display text-xl font-bold uppercase">Team inventory</h2>
        <p className="text-[11px] text-ink-muted">2 uses per team · no back-to-back weeks</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {teams.map((t) => {
          const dead = t.reason === "used_max";
          const blocked = !t.eligible && !dead;
          return (
            <button
              key={t.teamId}
              onClick={() => setOpen(open === t.teamId ? null : t.teamId)}
              title={t.eligible ? `${t.name} — available` : `${t.name} — ${REASON_LABEL[t.reason] ?? t.reason}`}
              className={`group flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition ${
                open === t.teamId
                  ? "border-gold bg-gold/10"
                  : dead
                    ? "border-edge/40 bg-surface-raised/30 opacity-45"
                    : blocked
                      ? "border-edge/60 bg-surface-raised/40 opacity-70"
                      : "border-edge bg-surface-raised/60 hover:border-gold/50"
              }`}
            >
              <span className={`text-xs font-bold ${dead ? "line-through" : ""}`}>{t.abbr}</span>
              <span className="flex gap-1" aria-label={`${t.usedWeeks.length} of 2 uses`}>
                <span className={`pip ${t.usedWeeks.length >= 1 ? (dead ? "pip--dead" : "pip--used") : ""}`} />
                <span className={`pip ${t.usedWeeks.length >= 2 ? "pip--dead" : ""}`} />
              </span>
            </button>
          );
        })}
      </div>

      {openTeam && (
        <div className="rise-in mt-4 rounded-xl border border-edge bg-surface-raised/50 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="display text-lg font-bold">{openTeam.name}</h3>
            <p className="text-xs text-ink-muted">
              {openTeam.reason === "used_max"
                ? "No uses left"
                : `${2 - openTeam.usedWeeks.length} use${2 - openTeam.usedWeeks.length === 1 ? "" : "s"} left`}
              {openTeam.usedWeeks.length > 0 && ` · you rode them wk ${openTeam.usedWeeks.join(", ")}`}
            </p>
          </div>
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            {teamGames.map((g) => {
              const home = g.homeTeamId === openTeam.teamId;
              const opp = home ? `vs ${g.awayAbbr}` : `@ ${g.homeAbbr}`;
              const mine = openTeam.usedWeeks.includes(g.week);
              const final = g.status === "final";
              const won = final && g.winnerTeamId === openTeam.teamId;
              const tied = final && g.winnerTeamId === null;
              return (
                <div
                  key={g.id}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 ${
                    g.week === currentWeek ? "bg-gold/10" : "odd:bg-surface-card/50"
                  }`}
                >
                  <span className="text-ink-muted">
                    <span className="num mr-2 inline-block w-8">W{g.week}</span>
                    {opp}
                    {mine && <span className="ml-1.5 text-[9px] font-bold uppercase text-gold">your ante</span>}
                  </span>
                  <span className={final ? (won ? "text-win" : tied ? "text-ink-muted" : "text-loss") : "text-ink-muted"}>
                    {final
                      ? `${won ? "W" : tied ? "T" : "L"} ${g.awayScore}–${g.homeScore}`
                      : new Date(g.kickoffAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
            {teamGames.length === 0 && <p className="text-ink-muted">Schedule loading…</p>}
          </div>
        </div>
      )}
    </section>
  );
}
