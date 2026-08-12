# CLAUDE.md — The Ante

Read this first in every session. Then read `ROADMAP.md` for where the last session left off, and `CHANGELOG.md` for what has changed. The five files in `docs/` are the product bible — treat them as canonical.

## What this is

**The Ante** is a season-long NFL points pool (free private beta, ~15–25 players, one league). Every player starts with **1,000 points**, picks **one team to win outright** each week (Weeks 1–18), wagers **100–1,000 points** (never more than bankroll; all-in forced if under 100), and the highest bankroll after Week 18 wins. Ties for first go to **Bankroll Overtime** through the playoffs. Launch deadline: **Wednesday, September 9, 2026** (Week 1 opens with a Wednesday game, so the early-game lock exception is active from day one).

## Canonical documents (in `docs/`)

| File | Role |
|---|---|
| `01-PRODUCT_SPEC.md` | Pages, flows, features, brand voice (poker-table vocabulary) |
| `02-GAME_RULES.md` | Single source of truth for game mechanics and edge cases |
| `03-ARCHITECTURE.md` | Stack, full data model, jobs, integrity requirements |
| `04-BUILD_PLAN.md` | Phase 0–4 schedule, Aug 12 → Sep 9 2026 |
| `05-DECISIONS.md` | Decision log — the "why". **Append here whenever a rule or architecture decision changes.** |

## Stack

Next.js (App Router, TypeScript, Tailwind v4) on **Vercel** · **Supabase** Postgres + Realtime (authoritative DB; service-role key server-only; RLS on client-exposed tables) · **Clerk** email-OTP auth (passwordless) · **Resend** transactional email · **ESPN public API** for schedule/results normalized into internal `nfl_games` (admin override on everything) · Vercel Cron for jobs (all idempotent).

## Hard rules that must never regress

- **Pre-reveal picks are secret.** No client, and no admin UI, ever sees another player's pick/wager before `weeks.revealed_at`. Enforced server-side and by RLS, not just UI.
- **Bankroll is reproducible from the ledger.** Every point movement is a `ledger` row with a unique idempotency key. Cached bankroll must always reconcile.
- **All jobs are idempotent.** Lock, auto-pick (seeded per user+week), settlement — safe to run twice with zero drift.
- **Settle only official finals.** Never provisional scores. During outages, picks wait in "awaiting official result".
- **Admin corrections never overwrite.** `audit_log` keeps before/after + reason + actor for every admin mutation.
- **Validation lives in Postgres, not just the client.** Wager bounds, one-pick-per-week, team usage (max 2, no consecutive weeks), overtime distinct wagers.
- Timestamps stored UTC; league deadlines rendered `America/New_York`; schedule times in viewer's local timezone.

## Brand voice

Dark FanDuel-style theme, mobile-first, **poker-gold accent** (from the chip-ring logo in `branding/`; purple/red-orange/teal are secondary/status colors). UI copy uses the table vocabulary (Ante Up, AUTO-ANTE, The Table, Table Talk, BUSTED, "Antes are in.", stack, take a seat). Database/mechanic names stay generic (`picks`, `auto`, `eliminated`). Name and logo are swappable tokens in code (`src/lib/brand.ts`).

## Session protocol (important)

1. **Start of session:** read this file, `ROADMAP.md` (esp. the Session Log), and `CHANGELOG.md`. Ask Robert nothing that these files already answer.
2. **During:** every meaningful code or design change gets a `CHANGELOG.md` entry. New decisions get a `05-DECISIONS.md` row.
3. **End of session:** update the ROADMAP Session Log (what was finished, what's next, any blockers), mark checklist progress, commit and push. Mirror CLAUDE.md/ROADMAP.md/CHANGELOG.md to Robert's local `Football Pool` folder if the device bridge is available.
4. If `CHANGELOG.md` exceeds ~500 lines, roll it over to `changelogs/CHANGELOG-<n>.md` and start fresh, keeping a pointer.

## Accounts & environments

- **GitHub:** **`rztoler/the-ante`** (private) is the source of truth; Vercel auto-deploys `main`. (`TheAnteGame/App` is a stale early copy — never push there. Robert's GitHub accounts: `rztoler` personal, `TheAnteGame` project-branded.)
- **Vercel:** account `roberttoler-8396`, project `the-ante`, production **https://the-ante-inky.vercel.app**, deployment protection off.
- **Supabase:** project ref `rhwkgsazsdtlufmzlarf` (URL `https://rhwkgsazsdtlufmzlarf.supabase.co`). Migrations live in `supabase/migrations/`; schema changes are applied by pasting SQL into the Supabase SQL Editor (sandbox can't reach the DB directly — see ROADMAP sandbox notes).
- **Clerk:** email OTP only, no passwords. Keys live in Vercel env since Aug 12.
- **Resend:** test domain until the real domain is purchased.
- Secrets live in Vercel env vars and `.env.local` (gitignored). **Never commit keys.** `.env.example` lists every required var.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (must pass before any push)
- `npm run lint` — ESLint
- `npm test` — engine unit tests (Vitest; the game engine in `src/lib/engine/` must stay heavily tested per docs/03 §Testing)

## Legal caution

Free beta = no consideration = not gambling under Arizona law (placeholder copy; attorney pass needed before any paid tier). Never add payment features without flagging this.
