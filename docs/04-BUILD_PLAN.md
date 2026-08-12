# The Ante — Build Plan, Aug 12 → Sep 9, 2026

Four weeks from today to Week 1 kickoff (**Wednesday Sep 9** — the opener is a Wednesday game, so the very first lock uses the early-game exception). The plan front-loads the game engine because it's the part that must be right; dashboard polish flexes if time gets tight.

## Phase 0 — Foundations (Aug 12–16)

Robert: create Vercel, Supabase, Resend, and Clerk accounts (in progress); ~~pick the name~~ **done — The Ante**; buy the domain (several verified-available candidates); finalize the logo from the mock concepts. Build: repo scaffold (Next.js + TS + Tailwind), Clerk wired with email OTP, Supabase project + initial migrations for the full schema, Vercel deploys on push, Resend domain verification once the domain exists (until then, Resend's test domain). Seed the 32 teams. Stand up `sync-schedule` against ESPN and ingest the full 2026 schedule — proves the data source immediately, when there's still time to fall back to manual entry.

**Exit criteria:** deployed app where you can log in with an email code, and `nfl_games` holds the real Weeks 1–18 schedule.

## Phase 1 — The game engine (Aug 17–23)

Signup/profile-completion flow with Pending → admin approval; How to Play page with Accept gate; pick submission (team eligibility, wager validation, edit-until-reveal); lock job with auto-pick generation; reveal (lock-time and early-reveal paths); settlement from final scores with ledger writes; elimination + ghost picks; the `weeks` state machine end to end. Engine unit tests written alongside, not after.

**Exit criteria:** a full simulated week runs cleanly — submit, lock, auto-pick a straggler, reveal, settle from a mocked final score, standings correct, ledger reconciles, all jobs re-runnable without drift.

## Phase 2 — Dashboard & social (Aug 24–30)

Player dashboard per the wireframe: weekly wager card with countdown, leaderboard with sortable stat views, team inventory with usage pips and team schedule drill-in, notices ticker with the deterministic scenario-callout generator, revealed weekly board with the flip moment, league chat on Supabase Realtime with admin mute, NFL schedule view, week history, fun stats (weekly superlatives first, season records after). Admin panel: approvals, submission status, lock override, results correction with audit trail, auto-pick review, chat moderation, CRM list.

**Exit criteria:** two browsers side by side feel like a live league — pick in one, checkmark appears in the other; reveal flips both; chat flows; admin can run a week without touching the DB.

## Phase 3 — Emails, polish, hardening (Aug 31–Sep 5)

Resend flows (approval, picks-open, reminders, reveal summary, Tuesday recap) on the production domain; mobile pass on every screen; empty/edge states (pre-approval, post-elimination ghost mode, unsettled "awaiting official result"); legal-notice copy finalized (attorney glance if possible); Playwright happy-path; load the beta roster as admin allowbase; run reconcile against a simulated multi-week season.

## Phase 4 — Dry run & launch (Sep 6–9)

Sep 6–7: real players onboard, approve everyone, run a practice "Week 0" against test games, then wipe game data (keep accounts). Sep 8: freeze, verify Week 1 lock shows **Wednesday** pre-kickoff time prominently, reminder emails armed. **Sep 9: live.**

## In-season operations (Robert's weekly ~15 minutes)

Mostly watch: approvals as stragglers join (weeks 1–2 only), glance at the Tuesday reconcile report, spot-check auto-picks after each lock, resolve any postponed/void rulings, mute anyone who crosses from trash talk into ugly. The admin panel is the only tool needed; the DB is never touched by hand.

## Deliberately deferred

Payments/subscription tier (revisit with a lawyer — charging entry changes the gambling analysis), multi-league UI, SMS, native/push, playoff Bankroll Overtime UI (build in December; schema and rules are already defined — it's a special `weeks` row per playoff round with the relaxed wager floor and distinct-wager constraint).
