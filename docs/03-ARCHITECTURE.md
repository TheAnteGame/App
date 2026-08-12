# The Ante — Architecture (Beta V1)

## Stack

- **App**: Next.js (App Router, TypeScript) on Vercel; brand name **The Ante** (UI copy uses the table vocabulary in `01-PRODUCT_SPEC.md`; database/mechanic names stay generic — `picks`, `auto`, `eliminated`); custom domain when bought (Cloudflare DNS).
- **Auth**: Clerk, email OTP only (passwordless). Clerk user → `users` row via webhook on first sign-in. Phone captured in our profile form, stored in Postgres, unused otherwise in beta.
- **Database**: Supabase Postgres — authoritative source of truth. Access from Next.js server code with the service-role key (server-only); Row Level Security on any table exposed to the client, notably chat.
- **Realtime**: Supabase Realtime for league chat and live dashboard updates (reveal flip, submission checkmarks, settlement).
- **Email**: Resend (transactional only).
- **NFL data**: ESPN's public scoreboard/schedule JSON API, normalized into internal `nfl_games` rows keyed by our own stable IDs (`espn_event_id` kept as an external reference so the provider can be swapped). Admin override on everything. Fallback if the unofficial API breaks: admin manual entry keeps the league running — every ingest path writes through the same normalizer.
- **Jobs**: Vercel Cron hitting authenticated route handlers; every job idempotent (see Integrity).

## Data model (Postgres)

Multi-league capable from day one (single league in beta). All timestamps UTC; league deadlines rendered `America/New_York`.

```
users            id, clerk_id, email, first_name, last_name, phone, role(player|admin),
                 status(pending|active|eliminated|removed), rules_accepted_at, muted_at, created_at
leagues          id, name, season, settings jsonb (lock rules, wager min/max, start bankroll)
league_members   league_id, user_id, joined_at            -- beta: one league, everyone in it
nfl_teams        id, abbr, name, conference, division, logo_url
nfl_games        id, season, week, home_team_id, away_team_id, kickoff_at, status
                 (scheduled|in_progress|final|postponed|canceled), home_score, away_score,
                 winner_team_id null, espn_event_id, updated_at
                 -- id is OURS and stable; kickoff changes update kickoff_at only
weeks            league_id, season, week, lock_at, lock_source(default|early_game|admin_override),
                 state(upcoming|open|locked|revealed|settled), revealed_at, is_overtime bool,
                 ot_round null(wildcard|divisional|conference|superbowl)
picks            id, league_id, user_id, season, week, team_id, game_id, wager int,
                 pick_type(manual|auto), is_ghost bool,   -- ghost = eliminated player's fun pick
                 state(draft|submitted|locked|settled), result(null|win|loss|push|void),
                 submitted_at, locked_at, settled_at
                 UNIQUE (league_id, user_id, season, week)
ledger           id, league_id, user_id, pick_id null, entry_type(starting_balance|wager_win|
                 wager_loss|push|admin_adjustment), amount int, bankroll_before, bankroll_after,
                 idempotency_key UNIQUE, reason, created_at
                 -- current bankroll = cached on users/league_members, MUST reconcile to ledger
standings_snapshots  league_id, season, week, user_id, rank, bankroll, wins, losses, created_at
chat_messages    id, league_id, user_id, body, created_at, deleted_by_admin_at null
audit_log        id, actor_user_id, action, entity, entity_id, before jsonb, after jsonb,
                 reason, created_at   -- every admin mutation writes here, no exceptions
```

Derived, not stored: team usage counts (from settled + locked picks), eligibility (usage < 2, not prior week's team, plays this week), scenario callouts, and all fun stats — computed from `picks` + `ledger` + `standings_snapshots`. Stats queries are read-time (materialize later only if slow at 25 players — it won't be).

## Enforcement at the database, not just the UI

Constraints/checks: wager bounds (100 ≤ wager ≤ 1000 AND wager ≤ bankroll_before; overtime weeks relax the floor to 1), one pick per user-week (unique index), distinct wagers within an overtime week (partial unique index on `(week, wager)` where `is_overtime`), team-usage and no-consecutive rules re-validated server-side on submit (a transaction that reads the player's pick history), ledger `idempotency_key` unique. The client validates for UX; Postgres validates for truth.

## Privacy model (hidden picks)

Pre-reveal picks are the crown jewels. Client never receives other players' pick rows before `weeks.revealed_at` — enforcement server-side in queries, and RLS denies direct reads of `picks` beyond the owner's rows pre-reveal. The admin UI also excludes pre-reveal picks (spec §11); emergency DB access is inherently auditable via Supabase logs.

## Jobs (Vercel Cron → route handlers)

| Job | Schedule | Does |
|---|---|---|
| `sync-schedule` | daily 06:00 ET (+ every 15 min during game windows) | Pull ESPN schedule/scores; upsert `nfl_games`; kickoff-time changes update rows, never IDs; flags weeks whose earliest kickoff is before default lock → sets `lock_at` to earliest kickoff minus buffer, marks `early_game` |
| `lock-week` | every 5 min (no-op unless a week's `lock_at` passed) | Transactionally: lock submitted picks → generate **auto-picks** for active non-submitters (random eligible team, seeded/idempotent) → set week `locked` → fire reveal (below) |
| `early-reveal` | event-driven on pick submission | If all active players have a submitted pick and week is `open`, flip to `revealed` immediately |
| `settle-games` | every 10 min during game windows | For `final` games only: settle affected picks (win/loss/push), write ledger entries with idempotency keys, update cached bankrolls, mark eliminations (bankroll 0 → status `eliminated`, future picks become ghost), snapshot standings when the week's last game settles, set week `settled` |
| `emails` | Wed 18:00 ET reminder; lock-time reveal summary; Tue 09:00 ET recap | Resend sends; suppressed for pending/removed users |

Reveal (whether from lock or early-reveal) broadcasts via Realtime so dashboards flip live.

## Integrity requirements (from spec §13–14, all kept)

Bankroll reproducible from ledger at all times — a `reconcile` admin action recomputes and diffs cached values. Lock, auto-pick, and settlement safe to run repeatedly (idempotency keys + state-machine guards on `weeks`/`picks`). Settlement only from `final` status. No guessing during data outages — picks stay unsettled with a visible "awaiting official result" state until data or admin resolves. Admin corrections never overwrite: original values preserved in `audit_log.before`, correction reason and actor required.

## Testing focus

Unit-test the pure engine hard: eligibility (usage/consecutive/bye), wager validation incl. sub-100 all-in, auto-pick eligibility, settlement math incl. push/void, elimination, scenario-callout generator, overtime distinct-wager validation incl. the degenerate-tie fallback, and idempotency (run every job twice in tests, assert no drift). One Playwright happy-path: signup → approve → pick → lock → reveal → settle → standings.
