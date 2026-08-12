-- The Ante — simulated week harness, step 3: FAKE FINALS
-- Run AFTER the lock-week job has revealed Week 1 (step 2 = trigger lock-week
-- via the run-job workflow). Marks every Week 1 game an official final with
-- the HOME team winning 27–20 → sim.win wins, sim.bust (away all-in) busts.
--
-- Settlement must then run with the ESPN refresh skipped so these hand-written
-- finals aren't overwritten first: run-job → settle-games → params `sync=0`.

update nfl_games
set status = 'final',
    home_score = 27,
    away_score = 20,
    winner_team_id = home_team_id,
    updated_at = now()
where season = 2026 and week = 1;

-- Sanity check: all Week 1 games final, week revealed.
select
  (select count(*) from nfl_games where season = 2026 and week = 1 and status = 'final') as finals,
  (select count(*) from nfl_games where season = 2026 and week = 1) as total_games,
  (select state from weeks where season = 2026 and week = 1
     and league_id = '00000000-0000-0000-0000-000000000001') as week1_state;
