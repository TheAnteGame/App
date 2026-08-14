# CHANGELOG — The Ante

Every meaningful change to code or design gets an entry, newest first within each date. When this file passes ~500 lines, roll it into `changelogs/CHANGELOG-1.md` and start fresh with a pointer.

Format: `- [area] What changed — why (if not obvious)`

---

## 2026-08-14 — Logo refresh + enum repair

- [fix] Dashboard showed "Season setup in progress": prod `week_state` enum was missing `open`, killing the current-week query (error surfaced via the new CRON_SECRET-gated `/api/jobs/debug-state` diagnostic). Migration 0005 re-asserts every enum value idempotently; Robert applied it; verified fixed — Week 1 card live.

- [branding] Robert delivered updated colored logo files; refreshed `branding/` + `public/brand/` (dark/light), deployed and verified live (checksums match source).

## 2026-08-12 — Session 1, part 6 (full rules conformance audit + fixes)

- [audit] Rule-by-rule conformance audit of docs/02 §1–9 vs code: crown-jewel rules (privacy, settlement discipline, elimination, AUTO-ANTE, locks) all CONFORM; discrepancies below fixed same-day. Decisions #10–#15 added to docs/05.
- [rules-fix] **Overtime team-use exemption** (docs/02 §8): OT weeks now skip max-2/no-consecutive checks in submitPick (only "plays this round" applies).
- [rules-fix] **Overtime wager ceiling** = full bankroll, not 1,000 (docs/02 §8): engine fixed + migration 0004 relaxes the DB CHECK.
- [rules-fix] **Validation now lives in Postgres** (CLAUDE.md hard rule): migration 0004 adds a `picks` BEFORE trigger enforcing wager-vs-live-bankroll bounds, sub-100 all-in, ghost 100–1,000 shadow antes, max-2 team uses, and no-consecutive-weeks at the database layer.
- [rules-fix] **Strict "official final"**: ESPN post-game state without `completed=true` now stays `in_progress` — settlement waits for the real final.
- [rules-fix] **Ghost picks obey the same team-use limits** vs their own full history (decision #11); shadow stack fixed at 1,000, documented.
- [rules-fix] **Phone required** at profile completion (docs/02 §1), client + server.
- [docs] docs/02 §4 privacy wording corrected: boundary is reveal, not lock (matches code + CLAUDE.md).
- [tests] 34 passing (OT full-bankroll wagers, ghost usage limits, strict-final normalization added).

## 2026-08-12 — Session 1, part 5 (first live users + polish)

- [auth-fix] Clerk dashboard config corrected (root causes of "code won't take"): **username requirement OFF** (was blocking every sign-up from finalizing), phone sign-up/sign-in/require OFF (Pro SMS features, unused by design — phone lives in our DB). Email is the only Clerk requirement now. Verified end-to-end with a `+clerk_test` signup.
- [auth-fix] EmailGate hardened: nested Clerk error codes handled, real error messages surfaced, finalize errors checked, hard redirect after session start.
- [admin] Pending queue: **Decline** button (sets status=removed, audit-logged) and **Email** button (mailto). Ante-status column relabeled "no ante yet" with an explanatory header (was misread as approval state).
- [dashboard] Gold "Commissioner" link in the menu for admins.
- [ops] Robert is live as commissioner (growthpropulsion email); two test accounts exist (ante.tester+clerk_test, rztoler gmail) — decline/ignore at will.

## 2026-08-12 — Session 1, part 4 (repo relocation + everything live)

- [infra] Per Robert's directive, production moved fully onto `TheAnteGame/App`: disconnected the Vercel project from `rztoler/the-ante`, removed the `rztoler` login connection from Vercel, Robert authorized the Vercel↔TheAnteGame GitHub link, project reconnected to `TheAnteGame/App`, deploy verified. `rztoler` is out of the pipeline entirely; its stray repo is deletable.
- [deploy] Landing glow-up + Phase 1 confirmed LIVE at https://the-ante-inky.vercel.app (email OTP box rendering, animated backdrop, Kanit headline).

## 2026-08-12 — Session 1, part 3 (Phase 1: the game engine)

- [engine] Pure engine library `src/lib/engine/` — eligibility (usage <2 / no-consecutive / bye), wager validation (100–1,000, ≤ stack, sub-100 forced all-in, overtime floor 1), seeded deterministic AUTO-ANTE (FNV-1a → mulberry32 per user+season+week), settlement (finals only; tie=push consuming usage; canceled=void; never settles in-progress/postponed), elimination at 0, ledger idempotency keys. **26 unit tests.**
- [auth] `EmailGate` — combined email-OTP sign-in/up on the landing page (Clerk v7 future API: `signIn.emailCode`, `signUp.verifications`), slide transition between email→code stages. Middleware now protects everything except `/` and `/api/jobs/*`.
- [auth] Lazy user provisioning in `requireUser()` (no Clerk webhook in beta — fewer moving parts; decision noted).
- [onboarding] `/welcome` profile completion (first/last/phone) → Pending; pending users see the "you're in line" state with How-to-Play access only.
- [rules] `/how-to-play` — distilled rules + detailed rules + legal placeholder, live player rail, one-time timestamped Accept gate (required before first pick).
- [picks] `src/lib/picks.ts` — submit/edit until reveal with full server-side validation; ghosts submit shadow antes (validated vs fixed 1000); early reveal fires the moment every active player is in.
- [dashboard] v1: header (name, rank, stack, BUSTED badge), weekly Ante card (live countdown, lock time w/ early-game note, eligible-team select with usage counts, wager input incl. forced all-in, win/lose projections, Ante Up, edit-until-reveal), The Table with rank/stack (ghosts dimmed).
- [jobs] `/api/jobs/lock-week` (lock submitted, seeded auto-antes for stragglers, reveal) and `/api/jobs/settle-games` (refresh ESPN scores, settle finals via idempotent ledger, cache bankrolls, eliminate at 0, snapshot standings, close week). Both cron-secret-gated, both re-runnable with zero drift.
- [admin] `/admin` (role-gated): pending approvals ("Give them a seat" → activate + league membership + starting-balance ledger + audit log), player list w/ anted/waiting (names only pre-reveal), all-18-weeks state grid.
- [infra] vercel.json: daily cron backstops for lock/settle (Hobby plan limit — see ROADMAP blocker on in-season cadence).

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
- [fonts] Switched next/font/google → self-hosted `geist` package (sandboxed builds can't reach Google Fonts; also faster/deterministic on Vercel).
- [ingest] Lock computation anchors the week's Thursday on the LATEST kickoff (walking back), not the earliest — fixes weekend-only slates; 5 unit tests cover normal, Wednesday-opener, Thanksgiving, weekend-only, and empty cases.
- [jobs] sync-schedule route accepts `?secret=` in addition to the cron Bearer header so the admin can trigger it from a browser.
- [tooling] `scripts/push-via-api.mjs` — pushes the git tree via GitHub's Git Data API for sandboxed sessions that can't `git push` directly.
- [db] `supabase/ALL-IN-ONE.sql` — both migrations concatenated for pasting into the Supabase SQL Editor (sandbox can't reach the DB directly).
- [repo] First push to `TheAnteGame/App@main` (45 files).
- [deploy] Repo home moved: Vercel cloned `TheAnteGame/App` → **`rztoler/the-ante`** (private, now the source of truth) and created project `the-ante` on Vercel account `roberttoler-8396`. `TheAnteGame/App` is stale.
- [deploy] Production live at **https://the-ante-inky.vercel.app**; Vercel Authentication (deployment protection) disabled — it caused the "Request Access" wall.
- [db] Schema + seeds applied to Supabase by Robert via SQL Editor.
- [data] First `sync-schedule` run: 272 games / 18 weeks / 0 errors ingested from ESPN into `nfl_games`, week lock times computed (Week 1 = Wednesday early-game exception).
- [env] All 7 env vars set in Vercel by Robert (Supabase ×3, Clerk ×2, CRON_SECRET, APP_URL).
- [design] Landing page glow-up (Robert's direction): logo doubled with gold glow; **Kanit italic** added as the display font (self-hosted, matches the logo's hard italic cut — use `.display` class for headlines/CTAs app-wide); headline replaced brand-name repeat with a hook — "Can your stack survive 18 weeks?"; larger title/body type; animated casino-stage backdrop (drifting jewel-tone blobs in the four chip colors, rotating gold spotlight sweep, twinkle layer, vignette; pure CSS, honors prefers-reduced-motion). Verified via local Playwright screenshots, desktop + mobile.
