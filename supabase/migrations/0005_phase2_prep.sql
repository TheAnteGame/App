-- The Ante — Phase-2 prep hardening (remaining Aug 12 review findings)
-- 1) Pick-submit race guard: a team/wager mutation can no longer land once the
--    week has left 'upcoming' (closes the submit-vs-early-reveal race at the
--    source of truth, per CLAUDE.md "validation lives in Postgres").
-- 2) Dead states removed: week_state loses 'open'/'locked', pick_state loses
--    'draft'. Code never set them; the enums now describe reality:
--    weeks: upcoming -> revealed -> settled; picks: submitted -> locked -> settled.
-- 3) Table Talk groundwork (REQUIRED before Phase 2 chat ships): chat reads go
--    through RLS keyed to the Clerk identity (Supabase third-party auth), and
--    chat_messages joins the Realtime publication. Writes stay server-only.

-- ============================================================ 1) race guard

create or replace function guard_pick_mutation() returns trigger
language plpgsql
as $$
declare
  v_state text;
begin
  -- Escape hatch for future audit-logged admin corrections:
  --   set local ante.bypass_pick_guard = 'on';
  if current_setting('ante.bypass_pick_guard', true) = 'on' then
    return new;
  end if;

  select w.state::text into v_state
  from weeks w
  where w.league_id = new.league_id and w.season = new.season and w.week = new.week;

  if v_state is null or v_state <> 'upcoming' then
    raise exception 'week is closed to ante changes (state=%)', coalesce(v_state, 'missing');
  end if;
  return new;
end
$$;

-- Fires only when team_id/wager appear in the statement: the lock/settle/ghost
-- updates (state, locked_at, result, is_ghost) never trip it, and AUTO-ANTE
-- inserts happen while the week is still 'upcoming'.
drop trigger if exists picks_guard_mutation on picks;
create trigger picks_guard_mutation
  before insert or update of team_id, wager on picks
  for each row execute function guard_pick_mutation();

-- ============================================================ 2) enum shrink

-- Defensive remaps (no prod rows should hold dead values).
update weeks set state = 'upcoming' where state = 'open';
update weeks set state = 'revealed' where state = 'locked';
update picks set state = 'submitted' where state = 'draft';

alter table weeks alter column state drop default;
create type week_state_new as enum ('upcoming', 'revealed', 'settled');
alter table weeks
  alter column state type week_state_new using (state::text::week_state_new);
drop type week_state;
alter type week_state_new rename to week_state;
alter table weeks alter column state set default 'upcoming';

alter table picks alter column state drop default;
create type pick_state_new as enum ('submitted', 'locked', 'settled');
alter table picks
  alter column state type pick_state_new using (state::text::pick_state_new);
drop type pick_state;
alter type pick_state_new rename to pick_state;
alter table picks alter column state set default 'submitted';

-- ============================================================ 3) Table Talk auth

-- Membership check as SECURITY DEFINER: users/league_members are RLS-locked
-- with no client policies, so a plain policy subquery would see nothing.
create or replace function is_chat_member(p_league uuid) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from users u
    join league_members lm on lm.user_id = u.id
    where u.clerk_id = (select auth.jwt()->>'sub')
      and lm.league_id = p_league
      and u.status in ('active', 'eliminated')
  );
$$;

revoke all on function is_chat_member(uuid) from public;
grant execute on function is_chat_member(uuid) to authenticated;

-- Replace the blanket authenticated read: members only, admin-deleted hidden.
drop policy if exists chat_read on chat_messages;
create policy chat_read on chat_messages
  for select to authenticated
  using (is_chat_member(league_id) and deleted_by_admin_at is null);

-- Realtime: stream chat inserts to subscribed clients (idempotent add).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end
$$;
