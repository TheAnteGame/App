# CHANGELOG — The Ante

Every meaningful change to code or design gets an entry, newest first within each date. When this file passes ~500 lines, roll it into `changelogs/CHANGELOG-1.md` and start fresh with a pointer.

Format: `- [area] What changed — why (if not obvious)`

---

## 2026-08-12 — Session 1

- [docs] Created CLAUDE.md (project memory + session protocol), ROADMAP.md (phase checklist + session log), CHANGELOG.md (this file).
- [docs] Copied canonical `docs/` (5 files) and `branding/` (4 logo PNGs) from Robert's Football Pool folder into the repo.
- [scaffold] Next.js 16.3 (App Router, TypeScript, src dir, import alias `@/*`) + Tailwind v4 + ESLint 9, via create-next-app.
- [deps] Added `@supabase/supabase-js`, `@clerk/nextjs`, `resend`, `zod`.
- [design] Brand decision: primary accent = poker gold from the chip-ring logo; purple / red-orange / teal reserved as secondary & status colors. Dark FanDuel-style theme, mobile-first.
- [db] Initial migration: full schema per docs/03 — users, leagues, league_members, nfl_teams, nfl_games, weeks, picks, ledger, standings_snapshots, chat_messages, audit_log; DB-level constraints (wager bounds w/ overtime floor relaxation, one pick per user-week, overtime distinct wagers, ledger idempotency); RLS scaffolding.
- [db] Seed: all 32 NFL teams with abbr/conference/division.
- [ingest] `sync-schedule`: ESPN scoreboard/schedule normalizer → `nfl_games` (our stable IDs, `espn_event_id` as external ref), early-game lock computation, admin-override-friendly upserts.
- [app] Brand token module (`src/lib/brand.ts`) — name/logo/colors swappable per spec.
- [app] Dark theme + gold accent design tokens in Tailwind/globals.
- [auth] Clerk wired behind env placeholders (email OTP only); app boots without keys until Robert's Clerk account exists.
