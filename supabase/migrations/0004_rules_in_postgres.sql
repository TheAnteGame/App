-- The Ante — rules conformance fixes (from the Aug 12 rules audit)
-- 1) Overtime wagers run 1..FULL BANKROLL (docs/02 §8) — the old CHECK capped
--    all picks at 1,000, which breaks champion-tie overtime.
-- 2) CLAUDE.md hard rule "validation lives in Postgres": wager bounds vs live
--    bankroll, sub-100 all-in, max-2 team uses, and no-consecutive-weeks are
--    now enforced by a BEFORE trigger — the client validates for UX, Postgres
--    validates for truth. (One-pick-per-week and OT distinct wagers were
--    already DB-enforced in 0001.)

-- Relax the blanket wager CHECK; the trigger below enforces the real bounds.
alter table picks drop constraint if exists picks_wager_check;
alter table picks add constraint picks_wager_check check (wager >= 1);

create or replace function validate_pick_rules() returns trigger
language plpgsql
as $$
declare
  v_bankroll int;
  v_prior_uses int;
  v_prior_week_same_team int;
begin
  -- ---- wager bounds -------------------------------------------------------
  if new.is_ghost then
    -- Ghost shadow stack is a fixed 1,000 with normal antes (decision Aug 12).
    if new.wager < 100 or new.wager > 1000 then
      raise exception 'ghost ante must be 100-1000';
    end if;
  elsif new.is_overtime then
    -- docs/02 §8: floor 1, ceiling = full bankroll.
    select bankroll into v_bankroll from league_members
      where league_id = new.league_id and user_id = new.user_id;
    if v_bankroll is null then
      raise exception 'no league membership for pick';
    end if;
    if new.wager < 1 or new.wager > v_bankroll then
      raise exception 'overtime ante must be 1..bankroll (%)', v_bankroll;
    end if;
  else
    select bankroll into v_bankroll from league_members
      where league_id = new.league_id and user_id = new.user_id;
    if v_bankroll is null then
      raise exception 'no league membership for pick';
    end if;
    if v_bankroll < 100 then
      -- docs/02 §2: sub-100 stack must go all-in.
      if new.wager <> v_bankroll then
        raise exception 'stack under 100: must ante the whole % ', v_bankroll;
      end if;
    elsif new.wager < 100 or new.wager > 1000 or new.wager > v_bankroll then
      raise exception 'ante must be 100-1000 and at most bankroll (%)', v_bankroll;
    end if;
  end if;

  -- ---- team usage rules (regular season only; docs/02 §3, §8) -------------
  if not new.is_overtime then
    -- Max 2 uses per team per season. Voided picks still count (docs/02 §6);
    -- ghost history counts for ghosts (decision Aug 12).
    select count(*) into v_prior_uses from picks
      where league_id = new.league_id and user_id = new.user_id
        and season = new.season and team_id = new.team_id
        and week <> new.week and id is distinct from new.id;
    if v_prior_uses >= 2 then
      raise exception 'team % already used twice this season', new.team_id;
    end if;

    -- No consecutive weeks with the same team.
    select count(*) into v_prior_week_same_team from picks
      where league_id = new.league_id and user_id = new.user_id
        and season = new.season and team_id = new.team_id
        and week = new.week - 1 and id is distinct from new.id;
    if v_prior_week_same_team > 0 then
      raise exception 'team % was used last week (no back-to-back)', new.team_id;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists picks_validate_rules on picks;
create trigger picks_validate_rules
  before insert or update of team_id, wager, week on picks
  for each row execute function validate_pick_rules();
