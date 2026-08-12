# The Ante — Beta V1 Plan

**The Ante** is a season-long NFL points pool. Every player starts with 1,000 points, picks **one team to win outright** each week, antes **100–1,000 points**, and rides their stack to Week 18. Highest bankroll wins. Free private beta, ~15–25 players, launching before **Week 1 kickoff: Wednesday, September 9, 2026**.

Name rationale: the ante is the bet every player must post just to sit at the table — which is the game's core rule (everyone wagers every week; skip it and the app antes for you). Sport-agnostic for future seasons/leagues. Domain: Robert is purchasing (several verified-available candidates, e.g. antepool.com); logo in progress.

## Documents

| File | What it covers |
|---|---|
| [docs/01-PRODUCT_SPEC.md](docs/01-PRODUCT_SPEC.md) | Unified product spec — pages, flows, features (doc + wireframes + interview merged) |
| [docs/02-GAME_RULES.md](docs/02-GAME_RULES.md) | Canonical player-facing rules, incl. all resolved edge cases |
| [docs/03-ARCHITECTURE.md](docs/03-ARCHITECTURE.md) | Stack, data model, jobs, integrations, integrity requirements |
| [docs/04-BUILD_PLAN.md](docs/04-BUILD_PLAN.md) | 4-week build schedule from today (Aug 12) to launch (Sep 9) |
| [docs/05-DECISIONS.md](docs/05-DECISIONS.md) | Decision log — every contradiction/hole found and how it was resolved |

## The stack (decided)

Next.js (App Router) on **Vercel** · **Supabase** Postgres + Realtime (chat) · **Clerk** email-OTP auth · **Resend** transactional email · ESPN public API for schedule/results with admin override · Cloudflare DNS once the domain is bought.

## The core loop

SEE THE SCHEDULE → PICK ONE WINNER → BET 100–1,000 → LOCK IT → REVEAL → WATCH FOOTBALL

## Hard dates

- **Aug 12, 2026** — today; name decided (**The Ante**); accounts being set up (Vercel, Supabase, Resend, Clerk); domain purchase pending
- **Sep 6–8, 2026** — dry-run week with test data, players onboarded
- **Wed Sep 9, 2026** — Week 1 opens with a Wednesday game → Week 1 lock is **before Wednesday kickoff** (early-game exception active from day one)
- **Week 18 (early Jan 2027)** — champion decided; Bankroll Overtime through the playoffs only if first place is tied
