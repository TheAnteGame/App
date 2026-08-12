-- The Ante — simulated week harness, step 1: SETUP (paste into Supabase SQL Editor)
-- Phase 1 exit criterion: a full lock → auto-ante → reveal → settle cycle
-- against the live DB. Creates three test players and backdates Week 1's lock.
--
-- Cast of characters:
--   sim.win@theante.test  — antes 300 on the HOME team of Week 1's first game (will WIN → 1300)
--   sim.bust@theante.test — all-in 1000 on the AWAY team of another game (will LOSE → 0, BUSTED)
--   sim.lazy@theante.test — never antes (AUTO-ANTE takes over at lock)
-- Note: every OTHER active player (including the commissioner) also gets a
-- seeded AUTO-ANTE at lock — expected, and fully undone by SIM-4-CLEANUP.

begin;

-- Test users (active, rules accepted; clerk_id stays null — no login needed).
insert into users (email, first_name, last_name, phone, status, rules_accepted_at)
values
  ('sim.win@theante.test',  'Simone', 'Winner',    '555-0101', 'active', now()),
  ('sim.bust@theante.test', 'Sammy',  'Bustwell',  '555-0102', 'active', now()),
  ('sim.lazy@theante.test', 'Slater', 'Straggler', '555-0103', 'active', now());

-- Seats + starting-balance ledger rows (same shape as the approval flow).
insert into league_members (league_id, user_id, bankroll)
select '00000000-0000-0000-0000-000000000001', id, 1000
from users where email like 'sim.%@theante.test';

insert into ledger (league_id, user_id, entry_type, amount,
                    bankroll_before, bankroll_after, idempotency_key, reason)
select '00000000-0000-0000-0000-000000000001', id, 'starting_balance', 1000,
       0, 1000, 'start:00000000-0000-0000-0000-000000000001:' || id::text,
       'Simulated-week test seat'
from users where email like 'sim.%@theante.test';

-- sim.win: 300 on the home team of the earliest Week 1 game.
with g as (
  select id, home_team_id from nfl_games
  where season = 2026 and week = 1 order by kickoff_at asc limit 1
)
insert into picks (league_id, user_id, season, week, team_id, game_id, wager,
                   pick_type, state, submitted_at)
select '00000000-0000-0000-0000-000000000001', u.id, 2026, 1,
       g.home_team_id, g.id, 300, 'manual', 'submitted', now()
from users u, g where u.email = 'sim.win@theante.test';

-- sim.bust: all-in 1000 on the AWAY team of the second-earliest Week 1 game.
with g as (
  select id, away_team_id from nfl_games
  where season = 2026 and week = 1 order by kickoff_at asc offset 1 limit 1
)
insert into picks (league_id, user_id, season, week, team_id, game_id, wager,
                   pick_type, state, submitted_at)
select '00000000-0000-0000-0000-000000000001', u.id, 2026, 1,
       g.away_team_id, g.id, 1000, 'manual', 'submitted', now()
from users u, g where u.email = 'sim.bust@theante.test';

-- Backdate the lock so the lock-week job sees Week 1 as due.
update weeks set lock_at = now() - interval '1 minute'
where league_id = '00000000-0000-0000-0000-000000000001'
  and season = 2026 and week = 1 and state = 'upcoming';

commit;

-- Sanity check: expect 3 users / 3 seats / 2 submitted picks / week 1 due.
select
  (select count(*) from users where email like 'sim.%@theante.test') as sim_users,
  (select count(*) from league_members lm join users u on u.id = lm.user_id
     where u.email like 'sim.%@theante.test') as sim_seats,
  (select count(*) from picks where season = 2026 and week = 1) as week1_picks,
  (select state || ' / due=' || (lock_at <= now())::text from weeks
     where season = 2026 and week = 1
       and league_id = '00000000-0000-0000-0000-000000000001') as week1;
