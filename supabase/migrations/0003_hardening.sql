-- The Ante — Phase 1.5 hardening (post-review fixes)
-- 1) current_standings must respect RLS (was owner-rights: anon key could read it)
-- 2) settle_pick_atomic: ledger + bankroll + elimination in ONE transaction,
--    so settlement can never mark a pick settled without its ledger row, and
--    concurrent runs can't drift the cached bankroll.

alter view current_standings set (security_invoker = true);

create or replace function settle_pick_atomic(
  p_pick_id uuid,
  p_result  text,   -- 'win' | 'loss' | 'push' | 'void'
  p_delta   int,    -- signed bankroll delta
  p_reason  text
) returns text
language plpgsql
security definer
as $$
declare
  v_pick    picks%rowtype;
  v_member  league_members%rowtype;
  v_after   int;
  v_wrote   boolean := false;
begin
  -- Lock the pick row; only locked picks settle.
  select * into v_pick from picks where id = p_pick_id and state = 'locked' for update;
  if not found then
    return 'skip:not_locked';
  end if;

  -- Ghost picks: record the result, never touch points.
  if v_pick.is_ghost then
    update picks set state = 'settled', result = p_result::pick_result, settled_at = now()
    where id = p_pick_id;
    return 'ok:ghost';
  end if;

  -- Lock the member row so concurrent settlements serialize.
  select * into v_member from league_members
  where league_id = v_pick.league_id and user_id = v_pick.user_id
  for update;
  if not found then
    return 'err:no_membership';
  end if;

  v_after := v_member.bankroll + p_delta;

  insert into ledger (league_id, user_id, pick_id, entry_type, amount,
                      bankroll_before, bankroll_after, idempotency_key, reason)
  values (v_pick.league_id, v_pick.user_id, p_pick_id,
          (case when p_result = 'win' then 'wager_win'
                when p_result = 'loss' then 'wager_loss'
                else 'push' end)::ledger_entry_type,
          p_delta, v_member.bankroll, v_after,
          'settle:' || p_pick_id::text, p_reason)
  on conflict (idempotency_key) do nothing;
  v_wrote := found;

  if v_wrote then
    update league_members set bankroll = v_after
    where league_id = v_pick.league_id and user_id = v_pick.user_id;

    if v_after <= 0 then
      -- BUSTED: out of title contention; unsettled future picks become ghosts.
      update users set status = 'eliminated'
      where id = v_pick.user_id and status = 'active';
      update picks set is_ghost = true
      where league_id = v_pick.league_id and user_id = v_pick.user_id
        and season = v_pick.season and week > v_pick.week and settled_at is null;
    end if;
  end if;

  update picks set state = 'settled', result = p_result::pick_result, settled_at = now()
  where id = p_pick_id and state = 'locked';

  return case when v_wrote then 'ok:settled' else 'ok:already_ledgered' end;
exception when others then
  -- Whole block rolls back: pick stays locked ("awaiting official result"),
  -- error surfaces to the job log for admin attention. Never guess.
  return 'err:' || sqlerrm;
end
$$;
