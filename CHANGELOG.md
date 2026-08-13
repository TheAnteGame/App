# CHANGELOG — The Ante

Every meaningful change to code or design gets an entry, newest first within each date. When this file passes ~500 lines, roll it into `changelogs/CHANGELOG-1.md` and start fresh with a pointer.

Format: `- [area] What changed — why (if not obvious)`

---

## 2026-08-13 — Session 2, part 3 (Phase 2: the full live-league dashboard + commissioner console)

- [engine] `notices.ts` — deterministic scenario-callout engine (docs/01 ticker): pre-reveal ante counts/stragglers/lock urgency (names only, never picks), post-reveal ALL-IN = elimination-risk callouts, lead-change scenarios, AUTO-ANTE, shared fates, biggest swing, per-final result calls, settled-week wraps. 5 tests incl. a privacy assertion.
- [engine] `stats.ts` — fun-stats engine: weekly superlatives (biggest win, toughest beat, boldest ante, house-guests) + season records (most wins, riskiest avg ante, high-water stack, hot hand w/ push-preserving streaks); ghosts excluded. 4 tests. 53 total.
- [dashboard] **Reveal board flip** — the money spot flips from the ante form to the full board at reveal (staggered 3D card-flip, "Antes are in." banner): player, team, wager, W/L projections, live game status with pulse dot, result badges; ghosts dimmed in their own rail.
- [dashboard] **The Table** rebuilt: sortable views (Stack / W-L / Big win / Risk), rank-movement arrows vs last snapshot, pre-reveal anted/waiting status, BUSTED memorial rail.
- [dashboard] **Team inventory**: 32-team grid with usage pips + disabled states (bye / used-max strikethrough / no-back-to-back), tap-through to the team's full season schedule with the player's antes flagged.
- [dashboard] **Notices ticker**: CSS marquee (seamless dup-track, hover-pause, reduced-motion static).
- [dashboard] **Table Talk**: chat bubbles, server-action posting (mute + membership enforced server-side), Supabase Realtime refresh via Clerk JWT with a 20s poll fallback, muted-by-the-commish state.
- [dashboard] Below the fold: NFL schedule (18-week tabs, viewer-local times, live dots, winner highlighting), week history (per settled week: picks/results/deltas + post-week standings), fun-stats panels. Sticky section nav.
- [admin] **Commissioner console** rebuilt for the run-a-week-without-SQL exit criterion: one-click job runs (Lock & reveal / Refresh+settle / Settle-as-entered), lock override (ET input, upcoming weeks only, reason required), result correction with audit trail (blocked with a logged attempt once picks are settled — reversal is deliberately manual in beta), AUTO-ANTE review, Table Talk moderation (soft delete + mute/unmute), CRM table (contact, status, stack, ante status, joined, mute, payments stub), audit log viewer. All mutations audit-logged.
- [ui] Phase-2 CSS primitives: `.panel`, ticker marquee, card-flip/rise-in animations, usage pips, live-pulse dot, sticky section nav — all honoring prefers-reduced-motion.
- [ui] AnteCard: setState-in-effect lint error fixed (state-adjust-during-render pattern); lint now 0 errors.
- [qa] `/preview` route (404s unless ALLOW_PREVIEW=1 — never set in prod): mock-data render of every Phase 2 surface in pre/post-reveal states; `scripts/screenshot-preview.mjs` captures desktop+mobile via Playwright. Screenshots reviewed this session.

## 2026-08-13 — Session 2, part 2 (simulated week PASSED — Phase 1 exit criteria complete)

- [ops] **Full simulated week against the live DB, end to end:** SIM-1 seeded 3 test players + backdated the Week 1 lock; lock-week dealt 3 seeded AUTO-ANTES (2 real seats + sim.lazy), locked 5 picks, revealed — then re-ran as a perfect no-op (live idempotency proof). SIM-3 faked 16 official finals; settle-games (`sync=0`) settled all 5 (sim.win +300 → 1300; sim.bust all-in → 0, ELIMINATED; ghost/auto paths exercised), snapshotted standings, closed the week `settled` — then re-ran with zero drift. Reconcile clean at every step. SIM-4 + `sync-schedule?week=1` restored prod exactly (2 seats @ 1000, Week 1 upcoming, real Sep 9 lock). Migration 0005 was applied to prod first.
- [infra] `run-job` workflow now publishes each job response (emails redacted) to `results/latest.json` on the **`run-results`** branch — the observation channel for sandboxed sessions (Actions logs + vercel.app are outside the sandbox egress allowlist).
- [ops] Sim first attempt: all three SQL steps were pasted back-to-back (no jobs between), wiping the pre-existing real Week 1 pick and leaving fake finals live; recovered fully (pinger paused before firing, ESPN re-sync, reconcile clean). Runbook cadence now explicit in ROADMAP + `scripts/sim/README.md`.

## 2026-08-12 — Session 2 (pre-Phase-2 hardening: remaining review findings)

- [db] **Migration 0005** (`0005_phase2_prep.sql`): pick-submit race guard — a `picks_guard_mutation` BEFORE trigger rejects any team/wager mutation once the week has left `upcoming`, closing the submit-vs-early-reveal race at the DB layer (with a `set local ante.bypass_pick_guard` escape hatch for future audit-logged admin corrections).
- [db] Dead states removed (same migration): `week_state` drops `open`/`locked`, `pick_state` drops `draft` — enums now match the real state machines (weeks `upcoming→revealed→settled`, picks `submitted→locked→settled`). All code refs updated.
- [db] Table Talk groundwork (same migration): chat reads now RLS-gated to active/eliminated league members via a security-definer `is_chat_member()` keyed to the Clerk JWT (`auth.jwt()->>'sub'` ↔ `users.clerk_id`); admin-deleted messages hidden from clients; `chat_messages` added to the Realtime publication. Writes stay server-only. Decision #17.
- [security] Job routes: `?secret=` query param REMOVED (secrets in URLs leak into request logs/browser history); Bearer-header-only with a constant-time compare (`src/lib/cron-auth.ts`). Manual triggering moved to the new **run-job** GitHub Actions workflow (Actions → run-job → Run workflow; CRON_SECRET stays in Actions secrets). Decision #19.
- [jobs] Lock/settle orchestration extracted to a pure core (`src/lib/engine/jobs-core.ts`) over an injectable data layer; `src/lib/jobs.ts` is now the thin Supabase binding. Behavior unchanged.
- [tests] **10 new job-layer drift tests** (44 total): double-run no-ops, crash-replay (week forced back mid-transition) with zero pick/ledger/bankroll drift, seeded auto-pick determinism across replays, partial-finals week stays open, tie→push, elimination ghosting future picks.
- [jobs] Settle hardening: the week-complete check now counts `submitted` as well as `locked` picks, so a bug-state stray pick keeps the week open instead of being settled around.
- [jobs] `settle-games` accepts `?sync=0` (skip ESPN refresh) so the simulated-week harness can settle hand-written finals.
- [ops] New read-only `/api/jobs/reconcile` route (cron-gated): per-member cached-bankroll vs ledger-sum check, week states, pick counts — sim-week verification now, Phase 3 reconcile groundwork later.
- [rules] **Bankroll Overtime ruling closed (Robert): keep the docs/02 §8 playoff tiebreaker as written.** Decision #16; OT code paths stay dormant until January.
- [ops] Robert's local folder: applied `PASTE-INTO-SUPABASE-*.sql` files moved to `_to_delete/`.

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
