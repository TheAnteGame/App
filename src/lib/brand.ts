/**
 * Brand tokens — the ONLY place the product name, logo paths, and table vocabulary live.
 * Spec (docs/01): keep name/logo swappable in code. UI copy uses the poker-table
 * vocabulary; database/mechanic names stay generic.
 */

export const BRAND = {
  name: "The Ante",
  shortName: "Ante",
  tagline: "Pick one winner. Ante 100–1,000. Last stack standing takes the title.",
  logoOnDark: "/brand/logo-on-dark.png",
  logoOnLight: "/brand/logo-on-light.png",
  domain: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

/** Canonical table vocabulary (docs/01 — Brand voice). Use these, never ad-hoc synonyms. */
export const VOCAB = {
  submit: "Ante Up",
  submitted: "Your ante's in",
  deadline: (when: string) => `Antes due ${when}`,
  autoPick: "AUTO-ANTE",
  reveal: "Antes are in.",
  leaderboard: "The Table",
  chat: "Table Talk",
  bankrollFlavor: "stack", // "bankroll" stays the formal rules term
  eliminated: "BUSTED",
  signupCta: "Take a seat",
  approved: "You've got a seat at the table",
  raise: "upping the ante",
  champion: "Last stack standing",
} as const;

/**
 * Color tokens (mirrored in globals.css). Primary accent: poker gold from the
 * chip-ring logo. Purple / red-orange / teal are secondary & status colors.
 */
export const COLORS = {
  surface: "#0B0E13", // near-black dark surface
  surfaceRaised: "#141924",
  surfaceCard: "#1A2130",
  border: "#2A3242",
  gold: "#E5A33D", // primary accent — CTAs, countdowns, big numbers
  goldBright: "#F5C15D",
  purple: "#6B3FA0", // secondary — premium moments
  redOrange: "#E24A2E", // losses, eliminations, urgent states
  teal: "#1F7A6D", // wins, positive deltas
  textPrimary: "#F4F6FA",
  textSecondary: "#9AA5B5",
} as const;
