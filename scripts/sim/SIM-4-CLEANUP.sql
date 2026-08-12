-- The Ante — simulated week harness, step 4: CLEANUP
-- Run AFTER settlement is verified (reconcile route reports clean). Wipes every
-- trace of the sim: picks, ledger rows, snapshots, test users; restores real
-- players' bankrolls from the ledger (source of truth) and reopens Week 1.
--
-- FINAL STEP after this paste: run-job → sync-schedule → params `week=1`
-- (restores Week 1 game rows from ESPN and recomputes the real lock_at).

begin;

-- Sim artifacts for Week 1, in FK-safe order.
delete from standings_snapshots
where league_id = '00000000-0000-0000-0000-000000000001'
  and season = 2026 and week = 1;

delete from ledger
where league_id = '00000000-0000-0000-0000-000000000001'
  and pick_id in (select id from picks where season = 2026 and week = 1);

delete from picks
where league_id = '00000000-0000-0000-0000-000000000001'
  and season = 2026 and week = 1;

-- Restore every cached bankroll from the ledger (drops sim wins/losses for
-- real players too, since their sim ledger rows are gone).
update league_members lm
set bankroll = coalesce((
  select sum(amount) from ledger l
  where l.league_id = lm.league_id and l.user_id = lm.user_id
), 0)
where lm.league_id = '00000000-0000-0000-0000-000000000001';

-- Un-eliminate anyone the sim busted (pre-season: no legitimate eliminations
-- exist, so a blanket restore is safe).
update users set status = 'active' where status = 'eliminated';

-- Remove the test users entirely.
delete from ledger where user_id in (select id from users where email like 'sim.%@theante.test');
delete from league_members where user_id in (select id from users where email like 'sim.%@theante.test');
delete from users where email like 'sim.%@theante.test';

-- Reopen Week 1 (sync-schedule?week=1 afterwards restores the true lock_at).
update weeks set state = 'upcoming', revealed_at = null
where league_id = '00000000-0000-0000-0000-000000000001'
  and season = 2026 and week = 1;

commit;

-- Sanity check: expect 0 / 0 / 0 / upcoming, and every bankroll = ledger sum.
select
  (select count(*) from users where email like 'sim.%@theante.test') as sim_users_left,
  (select count(*) from picks where season = 2026 and week = 1) as week1_picks_left,
  (select count(*) from standings_snapshots where season = 2026 and week = 1) as snapshots_left,
  (select state from weeks where season = 2026 and week = 1
     and league_id = '00000000-0000-0000-0000-000000000001') as week1_state;

select lm.user_id, lm.bankroll,
       coalesce((select sum(amount) from ledger l
                 where l.league_id = lm.league_id and l.user_id = lm.user_id), 0) as ledger_sum
from league_members lm
where lm.league_id = '00000000-0000-0000-0000-000000000001';
