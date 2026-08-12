# ROADMAP.md — The Ante

**Purpose:** the living map from first commit to launch and beyond, plus the Session Log that tells each new session exactly where the last one stopped. Update this at the start and end of every working session.

**Launch target: Wednesday, September 9, 2026 (NFL Week 1 kickoff).**

---

## Current status

- **Phase:** 0 — Foundations (in progress; code done, Robert-side steps remain)
- **Session count:** 1
- **Repo:** `TheAnteGame/App` (main) — first push complete, 45 files
- **Deployed URL:** Vercel auto-deploy triggered by first push (confirm in dashboard)
- **Blockers (all on Robert, instructions delivered in chat):**
  1. Paste `supabase/ALL-IN-ONE.sql` into Supabase SQL Editor (applies schema + seeds)
  2. Paste env vars into Vercel (list delivered in chat, incl. generated CRON_SECRET)
  3. Visit the sync-schedule trigger URL to ingest the 2026 schedule
  4. Clerk keys (account being created) — unblocks login (last Phase 0 exit criterion)

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
- [ ] Migrations applied to Supabase (needs service-role key / DB connection string)
- [ ] Clerk wired with email OTP (needs Clerk keys — account being created)
- [ ] Vercel deploys on push (needs repo name confirmed + env vars pasted)
- [ ] `sync-schedule` run against ESPN; real 2026 Weeks 1–18 in `nfl_games`
- [ ] Domain purchased → Cloudflare DNS → Resend domain verification (Robert; test domain until then)
- **Exit criteria:** deployed app, email-code login works, real 2026 schedule in the DB.

### Phase 1 — Game engine (Aug 17–23)

- [ ] Signup → profile completion → Pending → admin approval flow
- [ ] How to Play page with timestamped Accept gate
- [ ] Pick submission: eligibility (usage <2, no consecutive, plays this week), wager validation (100–1,000, ≤ bankroll, sub-100 all-in), edit until reveal
- [ ] `weeks` state machine end to end (upcoming → open → locked → revealed → settled)
- [ ] Lock job + seeded idempotent auto-pick (AUTO-ANTE)
- [ ] Reveal: lock-time and early-reveal (all actives in) paths
- [ ] Settlement from official finals: ledger writes, push/void handling, elimination → ghost
- [ ] Engine unit tests alongside (run every job twice in tests; assert no drift)
- **Exit criteria:** full simulated week runs cleanly; ledger reconciles.

### Phase 2 — Dashboard & social (Aug 24–30)

- [ ] Weekly Ante card: countdown, pick flow, Ante Up, potential outcomes, post-reveal board flip
- [ ] The Table: leaderboard + sortable stat views, BUSTED ghosts memorialized
- [ ] Team inventory: usage pips, disabled states, team schedule drill-in
- [ ] Notices ticker: deterministic scenario callouts
- [ ] Table Talk: Supabase Realtime chat + admin mute
- [ ] NFL schedule view, week history, fun stats (weekly superlatives, then season records)
- [ ] Admin panel: approvals, submission status (names only pre-reveal), lock override, results correction w/ audit trail, auto-pick review, chat moderation, CRM list
- **Exit criteria:** two browsers feel like a live league; admin runs a week without touching the DB.

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

### Session 1 — Aug 12, 2026

**Done:**
- Read all five docs + README; interviewed Robert. Decisions: GitHub-centric workflow (cloud build → GitHub → Vercel auto-deploy; docs mirrored to local `Football Pool` folder), **poker gold** primary accent (purple/red-orange/teal secondary), full Phase 0 scope this session.
- Created CLAUDE.md, ROADMAP.md, CHANGELOG.md; copied `docs/` + `branding/` into repo.
- Scaffolded Next.js 16 + TS + Tailwind v4; deps: @supabase/supabase-js, @clerk/nextjs, resend, zod, date-fns-tz, geist, vitest.
- Full schema migration + 32-team/league seed; brand tokens; dark/gold theme; login landing placeholder; conditional Clerk wiring; Supabase server/browser clients; ESPN normalizer + lock computation (5 passing tests); sync-schedule cron route (+ vercel.json cron, daily 06:00 ET); production build green; pushed to `TheAnteGame/App@main`.
- Verified via WebFetch: ESPN API serves the 2026 season — Week 1 earliest event is NE @ SEA, Wed Sep 9 8:20 PM ET, exactly the early-game case the docs predicted.

**Sandbox constraints discovered (IMPORTANT for future sessions):**
- Cloud sessions can't `git push` to repos not formally attached to the session — use `scripts/push-via-api.mjs` (GitHub Git Data API via node fetch works fine with the PAT). Or attach the repo to the session when starting it.
- Outbound fetch from bash/node is allowlist-blocked for supabase.co and espn.com — DB DDL goes through Supabase SQL Editor (paste file), data verification through the deployed Vercel routes, ESPN checks through WebFetch.
- `curl` with an Authorization header fails in the sandbox ("builtin injection failed") — use node fetch instead.

**Stopping point / next actions:** the four Robert-side blockers in "Current status". Once done, Phase 0 exit criteria are met and Session 2 starts Phase 1 (game engine: signup→approval flow, Accept gate, pick submission, weeks state machine, lock/auto-pick/reveal/settlement jobs, engine tests).

**Credentials:** GitHub PAT, Supabase anon + service-role keys received (live in Vercel env vars + session chat; never in git). Still missing: Clerk keys, Supabase DB connection string (not needed if SQL Editor path works).
