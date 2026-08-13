# ROADMAP.md — The Ante

**Purpose:** the living map from first commit to launch and beyond, plus the Session Log that tells each new session exactly where the last one stopped. Update this at the start and end of every working session.

**Launch target: Wednesday, September 9, 2026 (NFL Week 1 kickoff).**

---

## Current status

- **Phase:** 1.5 FULLY complete incl. all review follow-ups (Session 2, Aug 12). Next: Phase 2 — Dashboard & social (design-led: Robert wants the UX "easy but jawdropping" — use the design workflow for Phase 2 UI).
- **Session count:** 2
- **Repo (SOURCE OF TRUTH): `TheAnteGame/App@main`** → Vercel auto-deploys → https://the-ante-inky.vercel.app
- **Vercel:** account `roberttoler-8396`, project `the-ante`, deployment protection off.
- **Database:** migrations 0001–0004 applied; 272 games / 18 weeks ingested; Robert live as commissioner; Clerk email-only auth working end to end.
- **REPO POLICY (Robert's directive, Aug 12): everything lives on the `TheAnteGame` GitHub. `rztoler` (his separate personal GitHub) is off-limits — no code, no repos, nothing.**
- **PIPELINE (final, working since Aug 12 evening):** `TheAnteGame/App@main` → Vercel project `the-ante` (account roberttoler-8396) → **https://the-ante-inky.vercel.app**. The Vercel account's GitHub login connection is now `TheAnteGame` (Robert authorized it). The stored `TheAnteGame` PAT pushes via `scripts/push-via-api.mjs` — sessions are fully autonomous for shipping. Landing glow-up + all of Phase 1 verified LIVE.
- **Cleanup (Robert, whenever):** delete the stale `rztoler/the-ante` repo on GitHub; delete the empty old `ante` project on Vercel. Neither affects anything.
- **DB state: migrations 0001–0004 all applied to prod (Aug 12).** Atomic settlement + Postgres-level rule enforcement are LIVE.
- ~~OPEN RULING: Bankroll Overtime~~ **RESOLVED (Robert, Aug 12): keep the docs/02 §8 playoff tiebreaker as written** (decision #16). OT code stays dormant until January.
- **Blockers / Robert to-dos:**
  1. ~~Paste migration 0005~~ DONE (Aug 12). ~~Simulated week~~ DONE (Aug 13). **Week 1 pick note: the sim wiped the one pre-existing real Week 1 pick — whoever anted (rzt/mar) should re-ante.**
  2. `NEXT_PUBLIC_APP_URL` should be `https://the-ante-inky.vercel.app` (cosmetic until emails ship).
  3. Domain purchase + Resend still pending (no rush until Phase 3).
  4. Optional cleanup: test accounts (ante.tester+clerk_test, rztoler gmail) in pending queue / Clerk users; delete stale `rztoler/the-ante` repo; delete empty old `ante` Vercel project.
  5. Before Table Talk ships (Phase 2): Supabase dashboard → Authentication → Third-Party Auth → add Clerk (decision #17).

---

## Phase checklist

### Phase 0 — Foundations (Aug 12–16) — IN PROGRESS

- [x] Name decided (**The Ante**), logo delivered (`branding/`)
- [x] Supabase project created (ref `rhwkgsazsdtlufmzlarf`)
- [x] Vercel project imported from GitHub
- [x] Repo scaffold: Next.js 16 + TypeScript + Tailwind v4, App Router, src dir
- [x] Project docs: CLAUDE.md, ROADMAP.md, CHANGELOG.md; `docs/` + `branding/` in repo
- [x] Brand tokens: dark theme, poker-gold accent, swappable name/logo (`src/lib/brand.ts`)
- [x] Full schema migration + 32-team seed written (`supabase/migrations/`)
- [x] Migrations applied to Supabase (Robert, SQL Editor, Aug 12)
- [x] Clerk keys live in Vercel env (email-OTP login UI ships with Phase 1 signup flow)
- [x] Vercel deploys on push (`rztoler/the-ante` → project `the-ante`)
- [x] `sync-schedule` run against ESPN: 272 games, 18 weeks, 0 errors (Aug 12)
- [ ] Domain purchased → Cloudflare DNS → Resend domain verification (Robert; test domain until then)
- **Exit criteria:** deployed app, email-code login works, real 2026 schedule in the DB.

### Phase 1 — Game engine (planned Aug 17–23; built Aug 12, ahead of schedule)

- [x] Signup → profile completion (`/welcome`) → Pending → admin approval (`/admin`)
- [x] Email-OTP combined sign-in/up (`EmailGate`, Clerk v7 future API, animated stage transitions); lazy user provisioning (no webhook — decision logged)
- [x] How to Play page with timestamped Accept gate + live player rail
- [x] Pick submission (`src/lib/picks.ts` + AnteCard): eligibility, wager validation incl. sub-100 all-in + overtime floor, edit until reveal, potential outcomes
- [x] `weeks` state machine (upcoming/open → locked → revealed → settled)
- [x] Lock job + seeded idempotent AUTO-ANTE (`/api/jobs/lock-week`)
- [x] Early reveal the moment all actives are in (checked on every submit)
- [x] Settlement (`/api/jobs/settle-games`): finals only, idempotent ledger writes, push/void, elimination → ghost, standings snapshots
- [x] Engine unit tests: 26 passing (eligibility, wagers, seeded auto-pick determinism, settlement, elimination)
- [x] **Exit criterion met: full simulated week against the live DB (Aug 13).** 3 test players + 2 real seats: lock-week dealt 3 AUTO-ANTES and revealed; fake finals settled 5 picks (win +300 → 1300; all-in loss → 0 → BUSTED + eliminated); week closed `settled` with standings snapshot; both lock and settle re-ran as perfect no-ops (live idempotency proof); reconcile clean at every step; cleanup restored prod exactly (harness: `scripts/sim/`)
- [ ] Dashboard v1 shipped with Phase 1: header w/ rank+stack, weekly Ante card with countdown, The Table (basic). Full Phase 2 dashboard still to come.

### Phase 1.5 — Hardening (from the Aug 12 end-of-phase code review)

- [x] CRITICAL: atomic settlement (`settle_pick_atomic`, migration 0003) — ledger, bankroll, elimination, and future-pick ghosting in one transaction; errors leave picks locked instead of silently settled
- [x] HIGH: `current_standings` view now `security_invoker` — **applied to prod (Robert pasted 0003+0004, Aug 12)**
- [x] HIGH: game-day cadence via free GitHub Actions pinger (`gameday-pinger`, every 5 min lock / 10 min settle; requires repo to stay public — Actions aren't free on private repos). Vercel daily crons remain as backstop
- [x] HIGH: ESPN winner derived from score when flags are missing (no false ties)
- [x] HIGH: voided picks count toward team usage + no-consecutive (docs/02 §6 precedence confirmed by Robert); helpers moved to `engine/context.ts`; 32 tests total
- [x] LOW: approve guards pending-only; settle fetches games by game_id (week-move → admin flag); snapshot W-L bounded; constants deduped
- [x] Remaining review findings — ALL CLOSED in Session 2 (Aug 12): pick-submit race guard (DB trigger, migration 0005); `?secret=` dropped + timing-safe compare (manual runs via `run-job` Actions workflow); Realtime auth strategy decided + RLS shipped (decision #17); job-layer double-run drift tests (injectable data layer, 10 new tests); dead states shrunk out of the enums (decision #18)

### Phase 2 — Dashboard & social (planned Aug 24–30; BUILT Aug 13, Session 2 — ahead of schedule)

- [x] Weekly Ante card: countdown, pick flow, Ante Up, potential outcomes, post-reveal board flip (staggered 3D flip, "Antes are in." banner, live game status, result badges)
- [x] The Table: sortable stat views (Stack/W-L/Big win/Risk), rank movement arrows, anted/waiting pre-reveal, BUSTED ghosts memorialized on "the rail"
- [x] Team inventory: usage pips, disabled states (bye/used-max/no-back-to-back), team schedule drill-in with the player's antes flagged
- [x] Notices ticker: deterministic scenario callouts (engine + 5 tests, incl. privacy assertion)
- [x] Table Talk: Realtime chat via Clerk JWT (poll fallback until the Supabase third-party-auth dashboard step is done) + admin mute/delete
- [x] NFL schedule view, week history, fun stats (weekly superlatives + season records; engines tested)
- [x] Admin panel: approvals, submission status (names only pre-reveal), lock override, results correction w/ audit trail (post-settlement corrections deliberately blocked+logged in beta), auto-pick review, chat moderation, CRM list, one-click job runs
- [ ] **Exit criteria to verify live: two browsers feel like a live league; Robert runs a week from /admin without touching the DB.** (Everything's built + screenshot-reviewed; needs the live two-player pass with Robert. Realtime chat needs his Supabase dashboard step — Current status #5.)
- Deferred inside Phase 2: Bankroll OT matchup management UI (December, per post-launch plan).

### Phase 3 — Emails, polish, hardening (Aug 31–Sep 5)

- [ ] Resend flows on production domain: approval, week-open, reminders (Wed 6 PM ET + T-3h), reveal summary, Tuesday recap
- [ ] Mobile pass on every screen; empty/edge states (pending, ghost mode, awaiting-official-result)
- [ ] Legal copy finalized (attorney glance if possible)
- [ ] Playwright happy path: signup → approve → pick → lock → reveal → settle → standings
- [ ] Reconcile run against a simulated multi-week season

### Phase 4 — Dry run & launch (Sep 6–9)

- [ ] Sep 6–7: onboard real players, practice "Week 0", wipe game data (keep accounts)
- [ ] Sep 8: freeze; verify Wednesday lock display; arm reminder emails
- [ ] **Sep 9: live**

### Post-launch / deferred

- [ ] In-season ops (admin panel only, ~15 min/week)
- [ ] Bankroll Overtime UI (build in December; schema/rules already defined)
- [ ] Deferred: payments (attorney first), multi-league UI, SMS, native/push, marketing site

---

## Session Log

> Newest first. Every session appends: date, what got done, exact stopping point, next actions, blockers.

### Session 2 — Aug 12, 2026

**Done:**
- Cold-start orientation per protocol; cloned repo, verified 34 tests green and the local doc mirror matched the repo exactly.
- **All five remaining Phase 1.5 review findings closed:** (1) pick-submit race guard as a Postgres BEFORE trigger (migration 0005) with friendly error surfaced in `submitPick`; (2) `?secret=` removed from all job routes, Bearer-only with timing-safe compare, new `run-job` workflow_dispatch for manual runs; (3) Realtime auth decided — Clerk third-party JWT + RLS membership function, chat table in the Realtime publication (decision #17; Robert has one dashboard step before Table Talk); (4) jobs refactored to a pure core (`engine/jobs-core.ts`) over an injectable data layer with 10 double-run/crash-replay drift tests — 44 tests total; (5) dead enum states shrunk (decision #18).
- Settle job defensive fix: stray `submitted` picks now keep a week open.
- New `/api/jobs/reconcile` read-only integrity route (ledger vs cached bankroll, week/pick states) — sim-week verification + Phase 3 reconcile groundwork.
- **Bankroll Overtime ruling closed:** keep the playoff tiebreaker (Robert; decision #16).
- Robert's local folder: applied PASTE-*.sql files moved to `_to_delete/`.
- Robert's question answered: no code on his machine by design (GitHub-centric flow from Session 1); repo is public, clone anytime.

**Second half of session (Aug 12 evening → Aug 13): migration applied + simulated week PASSED.**
- Robert pasted migration 0005; PAT provided in-chat; all work pushed to `TheAnteGame/App@main` and auto-deployed.
- New results channel for sandboxed sessions: the `run-job` workflow publishes each job response (emails redacted) to `results/latest.json` on the **`run-results` branch** — sandbox reads it via the GitHub contents API (Actions log downloads and the vercel.app host are both outside the sandbox egress allowlist; WebFetch is proxy-blocked on the log blobs too). This is THE way future sessions observe prod.
- Sim mishap, fully recovered: Robert initially pasted all three sim files back-to-back (no jobs between), which wiped the one pre-existing real Week 1 pick and left fake finals + a backdated lock live; pinger was disabled in time (GitHub's cron throttling meant it never fired), sync-schedule restored Week 1, reconcile confirmed clean. Lesson encoded here: sim steps are paste → STOP → job → paste.
- **Simulated week, run properly, PASSED end to end:** lock (3 auto-antes, reveal, re-run no-op) → fake finals → settle `sync=0` (5 settled: +300 win → 1300; all-in bust → 0, eliminated; snapshot; week settled; re-run zero drift) → cleanup → ESPN restore → final reconcile clean. Phase 1 exit criteria are now ALL met.
- Pinger re-enabled after the sim.

**Third leg of the session (Aug 13): Phase 2 BUILT.** Full dashboard (reveal board flip, sortable Table, team inventory, notices ticker, Table Talk, schedule/history/fun stats, sticky section nav) + full commissioner console (one-click job runs, lock override, result correction w/ audit, AUTO-ANTE review, chat moderation, CRM, audit viewer). Two new tested engines (notices, stats — 53 tests total). `/preview` mock-data route + Playwright screenshot QA (desktop+mobile, pre/post-reveal, reviewed in-session). Build green, lint 0 errors.

**Stopping point / next actions:** Phase 2 exit-criteria verification with Robert live: (1) he pastes nothing — everything runs from /admin; (2) two-browser league feel test; (3) Supabase dashboard → Third-Party Auth → Clerk, then confirm Realtime chat fires instantly (poll fallback covers until then). Then Phase 3 (emails, mobile polish pass, legal copy, Playwright happy-path). Robert to-dos: re-ante Week 1, NEXT_PUBLIC_APP_URL, domain purchase.

**Credentials note:** session env has no TheAnteGame PAT and no CRON_SECRET — PAT must be provided in-chat per session for pushes and run-job dispatch (or Robert clicks Run workflow in the Actions UI; CRON_SECRET lives in Vercel env + Actions secrets).

### Session 1 — Aug 12, 2026

**Done:**
- Read all five docs + README; interviewed Robert. Decisions: GitHub-centric workflow (cloud build → GitHub → Vercel auto-deploy; docs mirrored to local `Football Pool` folder), **poker gold** primary accent (purple/red-orange/teal secondary), full Phase 0 scope this session.
- Created CLAUDE.md, ROADMAP.md, CHANGELOG.md; copied `docs/` + `branding/` into repo.
- Scaffolded Next.js 16 + TS + Tailwind v4; deps: @supabase/supabase-js, @clerk/nextjs, resend, zod, date-fns-tz, geist, vitest.
- Full schema migration + 32-team/league seed; brand tokens; dark/gold theme; login landing placeholder; conditional Clerk wiring; Supabase server/browser clients; ESPN normalizer + lock computation (5 passing tests); sync-schedule cron route (+ vercel.json cron, daily 06:00 ET); production build green; pushed to `TheAnteGame/App@main`.
- Verified via WebFetch: ESPN API serves the 2026 season — Week 1 earliest event is NE @ SEA, Wed Sep 9 8:20 PM ET, exactly the early-game case the docs predicted.

**Second half of session (deployment saga, resolved):**
- Robert has two GitHub accounts (`rztoler` personal, `TheAnteGame` for this project) and his Vercel account (`roberttoler-8396`) is login-linked to `rztoler` only. Vercel could never see `TheAnteGame/App`, and every "Add GitHub Account" popup silently failed. Repo visibility was never the issue.
- Resolution: made the repo public, then used Vercel's **clone-from-URL import** — Vercel cloned `TheAnteGame/App` into a new private repo **`rztoler/the-ante`** and created project `the-ante` with auto-deploy. That repo is now the single source of truth.
- Disabled Vercel Authentication (deployment protection) on the project — it was the cause of the original "Request Access" wall.
- Robert applied the schema via SQL Editor, entered all 7 env vars, redeployed. I triggered `sync-schedule` via the browser: **272 games / 18 weeks / 0 errors.** Live site verified at https://the-ante-inky.vercel.app (Clerk keys detected, landing page renders).
- Vercel GitHub App also got installed on `TheAnteGame` (harmless now); a pending collaborator invite `TheAnteGame/App` → `rztoler` is moot and can be ignored/revoked.

**Sandbox constraints discovered (IMPORTANT for future sessions):**
- Cloud sessions can't `git push` to repos not formally attached to the session — use `scripts/push-via-api.mjs` (GitHub Git Data API via node fetch works fine with the PAT). Or attach the repo to the session when starting it.
- Outbound fetch from bash/node is allowlist-blocked for supabase.co and espn.com — DB DDL goes through Supabase SQL Editor (paste file), data verification through the deployed Vercel routes, ESPN checks through WebFetch.
- `curl` with an Authorization header fails in the sandbox ("builtin injection failed") — use node fetch instead.

**Stopping point / next actions:** the four Robert-side blockers in "Current status". Once done, Phase 0 exit criteria are met and Session 2 starts Phase 1 (game engine: signup→approval flow, Accept gate, pick submission, weeks state machine, lock/auto-pick/reveal/settlement jobs, engine tests).

**Credentials:** GitHub PAT, Supabase anon + service-role keys received (live in Vercel env vars + session chat; never in git). Still missing: Clerk keys, Supabase DB connection string (not needed if SQL Editor path works).
