import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID } from "@/lib/constants";

/**
 * Commissioner-editable site copy. Every string here is a DEFAULT — the
 * shipped copy — and `site_content` rows override by key. Pages therefore
 * work with an empty table, a missing table, or no DB at all (preview).
 *
 * Keys ending in `Html` hold sanitized rich HTML (rendered inside `.rich`);
 * everything else is plain text. The landing headline supports *stars* →
 * gold highlighting.
 */

export const CONTENT_DEFAULTS = {
  // ---- Landing (Page 1) ----
  "landing.headline": "Can your stack survive *18 weeks*?",
  "landing.intro":
    "A season-long NFL points pool. Start with 1,000 points, back one team to win outright each week, and ante 100–1,000 on your gut. Highest bankroll after Week 18 is the last stack standing.",
  "landing.emailPlaceholder": "your@email.com",
  "landing.emailFine":
    "We'll email you a 6-digit code — no passwords here. By continuing you agree to receive league emails. Free to enter; not a gambling service.",
  "landing.codeSentPrefix": "Code sent to",
  "landing.codePlaceholder": "6-digit code",
  "landing.useDifferentEmail": "Use a different email",
  "landing.footer": "Free-to-enter game of skill. No purchase necessary.",

  // ---- Profile completion (Page 2) ----
  "welcome.title": "Take a seat",
  "welcome.subtitle": "Tell the table who you are. The commissioner approves every seat.",
  "welcome.firstPlaceholder": "First name",
  "welcome.lastPlaceholder": "Last name",
  "welcome.phonePlaceholder": "Mobile phone (stored for later — we only email in beta)",
  "welcome.button": "Take my seat →",

  // ---- Pending state ----
  "pending.title": "You're in line",
  "pending.body":
    "The commissioner has your request. You'll get an email when you've got a seat at the table.",

  // ---- How to Play (Page 3) ----
  "howto.title1": "How to Play",
  "howto.section1Html": `<ol><li>Everyone starts the season with a <strong>1,000-point stack</strong>.</li><li>Each week, pick <strong>one NFL team to win outright</strong> — no spreads, no props.</li><li>Ante <strong>100–1,000 points</strong> on it (never more than your stack).</li><li>Win: the ante is added to your stack. Lose: it's gone.</li><li>Antes are due before the weekly lock. Miss it and the house antes for you: a random eligible team, 100 points — the <strong class="c-gold">AUTO-ANTE</strong>.</li><li>Highest bankroll after Week 18 is the last stack standing.</li></ol>`,
  "howto.title2": "Detailed Rules",
  "howto.section2Html": `<p><strong>Team limits.</strong> Each team can be used at most twice per season, and never in back-to-back weeks. The team inventory shows every team as 0/2, 1/2, or 2/2 with ineligible teams disabled.</p><p><strong>Lock &amp; reveal.</strong> Antes are due Thursday 3:00 PM Eastern — unless a game kicks off earlier that week, in which case the lock moves ahead of the first kickoff (the actual time is always shown). You can edit your pick until reveal. Reveal happens at lock, or the moment every active player is in — whichever comes first. Until then, nobody sees anyone else's pick or ante; after, everything flips face-up at once.</p><p><strong>Short stacks.</strong> If your bankroll drops under 100, you must ante the whole thing. Win and you're rebuilding; lose and you're <strong class="c-orange">BUSTED</strong>.</p><p><strong>Busting.</strong> A bankroll of zero eliminates you from title contention — no rebuys, no rescue points. Busted players stay at the table as ghosts: keep making picks for bragging rights, keep full access to chat and stats. Ghost picks never affect standings.</p><p><strong>Results.</strong> Only official finals settle a wager. A tie is a push — no points move, but the team use still counts. Postponed games carry inside the same week; canceled games push with your ante restored.</p><p><strong>Tiebreak.</strong> If first place is tied after Week 18, tied players go to Bankroll Overtime through the playoffs — one outright winner per round, distinct antes enforced, minimum ante drops to 1 so it always works. Still tied after the Super Bowl? The title is shared.</p>`,
  "howto.title3": "Legal Notices",
  "howto.section3Html": `<p>The Ante is a free-to-enter game of skill played for bragging rights. There is no entry fee, no buy-in, and no cash prize — no consideration is exchanged, and this league is not gambling under Arizona law. Placeholder notice: final language pending attorney review before any paid tier is ever considered.</p>`,
  "howto.railTitle": "At the table",
  "howto.acceptButton": "I've read it — deal me in",
  "howto.acceptNote": "Required once before your first pick. Your acceptance is timestamped.",
} as const;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;
export type SiteContent = Record<ContentKey, string>;

export async function getContent(): Promise<SiteContent> {
  const merged: Record<string, string> = { ...CONTENT_DEFAULTS };
  try {
    const db = supabaseAdmin();
    const { data } = await db.from("site_content").select("key, value");
    for (const row of data ?? []) {
      if (row.key in CONTENT_DEFAULTS && typeof row.value === "string") {
        merged[row.key] = row.value;
      }
    }
  } catch {
    // no DB (preview/local) — defaults carry the page
  }
  return merged as SiteContent;
}

export type TickerItem = {
  id: string;
  text: string;
  color: "gold" | "purple" | "orange" | "teal" | "muted";
  position: number;
  active: boolean;
};

export async function getTickerItems(includeInactive = false): Promise<TickerItem[]> {
  try {
    const db = supabaseAdmin();
    let q = db
      .from("ticker_items")
      .select("id, text, color, position, active")
      .eq("league_id", BETA_LEAGUE_ID)
      .order("position")
      .order("created_at");
    if (!includeInactive) q = q.eq("active", true);
    const { data } = await q;
    return (data ?? []) as TickerItem[];
  } catch {
    return [];
  }
}

/** Landing headline helper: split "*gold*" spans out of the plain string. */
export function headlineParts(headline: string): { text: string; gold: boolean }[] {
  return headline
    .split(/\*([^*]+)\*/g)
    .map((part, i) => ({ text: part, gold: i % 2 === 1 }))
    .filter((p) => p.text.length > 0);
}
