import type { Superlative } from "@/lib/engine/stats";

const TONE: Record<Superlative["tone"], string> = {
  win: "border-win/30 text-win",
  loss: "border-loss/30 text-loss",
  gold: "border-gold/30 text-gold",
  info: "border-edge text-ink-muted",
};

/** Fun stats (docs/01 Page 4): weekly superlatives + season records. */
export default function StatsPanels({
  weekly,
  season,
  lastSettledWeek,
}: {
  weekly: Superlative[];
  season: Superlative[];
  lastSettledWeek: number | null;
}) {
  if (weekly.length === 0 && season.length === 0) {
    return (
      <section className="panel p-5 sm:p-6">
        <h2 className="display mb-2 text-xl font-bold uppercase">Fun stats</h2>
        <p className="text-sm text-ink-muted">
          The stories start once the first week settles — biggest win, toughest beat, boldest ante.
        </p>
      </section>
    );
  }
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="display mb-4 text-xl font-bold uppercase">Fun stats</h2>
      <div className="grid gap-5 md:grid-cols-2">
        {weekly.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-ink-muted/70">
              Week {lastSettledWeek} superlatives
            </p>
            <div className="grid gap-1.5">
              {weekly.map((s, i) => (
                <div
                  key={s.key}
                  className={`rise-in rounded-lg border bg-surface-raised/40 px-3.5 py-2.5 ${TONE[s.tone]}`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide">{s.title}</p>
                  <p className="text-sm text-ink">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {season.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-ink-muted/70">
              Season records
            </p>
            <div className="grid gap-1.5">
              {season.map((s, i) => (
                <div
                  key={s.key}
                  className={`rise-in rounded-lg border bg-surface-raised/40 px-3.5 py-2.5 ${TONE[s.tone]}`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide">{s.title}</p>
                  <p className="text-sm text-ink">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
