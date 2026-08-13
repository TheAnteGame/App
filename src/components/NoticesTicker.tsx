import type { Notice } from "@/lib/engine/notices";

const TONE: Record<Notice["kind"], string> = {
  info: "text-ink-muted",
  gold: "text-gold",
  win: "text-win",
  loss: "text-loss",
};

/**
 * Notices ticker (docs/01 Page 4): deterministic scenario callouts scrolled
 * news-ticker style. Server component — content is computed server-side; the
 * marquee itself is pure CSS (duplicated track for a seamless loop).
 */
export default function NoticesTicker({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;
  const duration = Math.max(24, notices.length * 7);
  const items = (keyPrefix: string) =>
    notices.map((n, i) => (
      <span key={`${keyPrefix}-${i}`} className={`text-sm ${TONE[n.kind]}`}>
        <span className="mr-2 text-gold/60">✦</span>
        {n.text}
      </span>
    ));
  return (
    <div className="panel ticker px-4" role="marquee" aria-label="League notices">
      <div className="ticker-track" style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}>
        {items("a")}
        {/* duplicate for the seamless wrap */}
        {items("b")}
      </div>
    </div>
  );
}
