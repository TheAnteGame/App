import { VOCAB } from "@/lib/brand";
import type { BoardRow } from "@/lib/board";

/**
 * The revealed weekly board (docs/01 Reveal behavior): the moment reveal
 * fires, the money spot flips from the ante form to this — player, team,
 * wager, potential outcomes, live game status → result. Staggered 3D card
 * flip on entry: the weekly dopamine moment.
 */

function gameLabel(r: BoardRow): { text: string; live: boolean } {
  const matchup = `${r.awayAbbr} @ ${r.homeAbbr}`;
  switch (r.gameStatus) {
    case "final":
      return { text: `${matchup} · ${r.awayScore ?? "–"}–${r.homeScore ?? "–"} F`, live: false };
    case "in_progress":
      return { text: `${matchup} · ${r.awayScore ?? 0}–${r.homeScore ?? 0}`, live: true };
    case "postponed":
      return { text: `${matchup} · postponed`, live: false };
    case "canceled":
      return { text: `${matchup} · canceled`, live: false };
    default: {
      const t = new Date(r.kickoffAt).toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      });
      return { text: `${matchup} · ${t}`, live: false };
    }
  }
}

function ResultBadge({ r }: { r: BoardRow }) {
  if (!r.result) return null;
  const map: Record<string, { label: string; cls: string }> = {
    win: { label: `+${r.wager}`, cls: "bg-win/15 text-win border-win/40" },
    loss: { label: `−${r.wager}`, cls: "bg-loss/15 text-loss border-loss/40" },
    push: { label: "PUSH", cls: "bg-edge/40 text-ink-muted border-edge" },
    void: { label: "VOID", cls: "bg-edge/40 text-ink-muted border-edge" },
  };
  const m = map[r.result];
  if (!m) return null;
  return (
    <span className={`num rounded-md border px-2 py-0.5 text-sm font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function RevealBoard({
  week,
  rows,
  meId,
  settled,
}: {
  week: number;
  rows: BoardRow[];
  meId: string;
  settled: boolean;
}) {
  const live = rows.filter((r) => !r.isGhost);
  const ghosts = rows.filter((r) => r.isGhost);

  return (
    <section className="panel border-gold/25 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="reveal-banner display text-2xl font-bold uppercase text-gold">
          {settled ? `Week ${week} — in the books` : VOCAB.reveal}
        </h2>
        <span className="display text-sm uppercase text-ink-muted">Week {week}</span>
      </div>

      <div className="flip-stage space-y-2">
        {live.map((r, i) => {
          const g = gameLabel(r);
          const mine = r.userId === meId;
          return (
            <div
              key={r.pickId}
              className={`flip-in rounded-xl border px-4 py-3 ${
                mine ? "border-gold/40 bg-gold/8" : "border-edge bg-surface-raised/70"
              }`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {r.firstName} {r.lastName?.[0]}.
                    {r.auto && (
                      <span className="ml-2 rounded bg-brand-purple/25 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-gold-bright">
                        {VOCAB.autoPick}
                      </span>
                    )}
                    {mine && <span className="ml-2 text-[10px] uppercase text-gold">you</span>}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                    {g.live && <span className="live-dot" aria-hidden="true" />}
                    {g.text}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-right">
                  <div>
                    <p className="display text-base font-bold leading-tight">{r.teamName}</p>
                    {!r.result && (
                      <p className="text-[11px] text-ink-muted">
                        <span className="text-win">W→{r.bankroll + r.wager}</span>
                        {" · "}
                        <span className="text-loss">L→{r.bankroll - r.wager}</span>
                      </p>
                    )}
                  </div>
                  {r.result ? (
                    <ResultBadge r={r} />
                  ) : (
                    <span className="num rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-sm font-semibold text-gold">
                      {r.wager}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {ghosts.length > 0 && (
          <div className="pt-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-ink-muted/70">
              Ghosts at the table
            </p>
            {ghosts.map((r, i) => {
              const g = gameLabel(r);
              return (
                <div
                  key={r.pickId}
                  className="flip-in mb-1.5 flex items-center justify-between rounded-lg border border-edge/50 bg-surface-raised/40 px-4 py-2 opacity-60"
                  style={{ "--i": live.length + i } as React.CSSProperties}
                >
                  <p className="text-sm">
                    {r.firstName} {r.lastName?.[0]}.
                    <span className="ml-2 text-[10px] font-bold text-loss">{VOCAB.eliminated}</span>
                    <span className="ml-2 text-xs text-ink-muted">{g.text}</span>
                  </p>
                  <p className="text-sm">
                    <span className="display mr-2">{r.teamName}</span>
                    <span className="num text-ink-muted">{r.wager}</span>
                    {r.result && (
                      <span className="ml-2 text-xs text-ink-muted">({r.result})</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
