-- The Ante — initial schema (Beta V1)
-- Source of truth: docs/03-ARCHITECTURE.md. All timestamps UTC (timestamptz).
-- Mechanic names stay generic; brand vocabulary lives only in UI copy.

-- ============================================================ enums

create type user_role as enum ('player', 'admin');
create type user_status as enum ('pending', 'active', 'eliminated', 'removed');
create type game_status as enum ('scheduled', 'in_progress', 'final', 'postponed', 'canceled');
create type week_state as enum ('upcoming', 'open', 'locked', 'revealed', 'settled');
create type lock_source as enum ('default', 'early_game', 'admin_override');
create type ot_round as enum ('wildcard', 'divisional', 'conference', 'superbowl');
create type pick_type as enum ('manual', 'auto');
create type pick_state as enum ('draft', 'submitted', 'locked', 'settled');
create type pick_result as enum ('win', 'loss', 'push', 'void');
create type ledger_entry_type as enum
  ('starting_balance', 'wager_win', 'wager_loss', 'push', 'admin_adjustment');

-- ============================================================ users

create table users (
  id                uuid primary key default gen_random_uuid(),
  clerk_id          text unique,                       -- linked on first Clerk sign-in via webhook
  email             text not null unique,
  first_name        text,
  last_name         text,
  phone             text,                              -- stored for future use only (docs/05 #7)
  role              user_role not null default 'player',
  status            user_status not null default 'pending',
  rules_accepted_at timestamptz,                       -- Accept gate, required before first pick
  muted_at          timestamptz,                       -- chat mute ("muted by the commish")
  created_at        timestamptz not null default now()
);

-- ============================================================ leagues (multi-league capable; beta uses one)

create table leagues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  season     int  not null,
  settings   jsonb not null default '{
    "start_bankroll": 1000,
    "wager_min": 100,
    "wager_max": 1000,
    "default_lock_dow": 4,
    "default_lock_time_et": "15:00",
    "max_team_uses": 2,
    "no_consecutive_weeks": true
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table league_members (
  league_id  uuid not null references leagues(id),
  user_id    uuid not null references users(id),
  joined_at  timestamptz not null default now(),
  bankroll   int not null default 1000,   -- CACHE; must always reconcile to ledger
  primary key (league_id, user_id)
);

-- ============================================================ NFL reference data

create table nfl_teams (
  id         int primary key,             -- our stable ID
  abbr       text not null unique,
  name       text not null,
  conference text not null check (conference in ('AFC', 'NFC')),
  division   text not null check (division in ('East', 'North', 'South', 'West')),
  logo_url   text
);

create table nfl_games (
  id             uuid primary key default gen_random_uuid(),  -- OURS and stable
  season         int not null,
  week           int not null,                                -- 1–18 regular; 19+ postseason rounds
  home_team_id   int not null references nfl_teams(id),
  away_team_id   int not null references nfl_teams(id),
  kickoff_at     timestamptz not null,      -- kickoff changes update this column only, never id
  status         game_status not null default 'scheduled',
  home_score     int,
  away_score     int,
  winner_team_id int references nfl_teams(id),               -- null until final; null on tie
  espn_event_id  text unique,                                 -- external ref so provider is swappable
  updated_at     timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index nfl_games_season_week on nfl_games (season, week);
create index nfl_games_kickoff on nfl_games (kickoff_at);

-- ============================================================ weeks (the state machine)

create table weeks (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references leagues(id),
  season       int not null,
  week         int not null,
  lock_at      timestamptz not null,
  lock_source  lock_source not null default 'default',
  state        week_state not null default 'upcoming',
  revealed_at  timestamptz,
  is_overtime  boolean not null default false,   -- Bankroll Overtime rounds (playoffs)
  ot_round     ot_round,
  unique (league_id, season, week),
  check (is_overtime = (ot_round is not null))
);

-- ============================================================ picks

create table picks (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references leagues(id),
  user_id      uuid not null references users(id),
  season       int not null,
  week         int not null,
  team_id      int not null references nfl_teams(id),
  game_id      uuid not null references nfl_games(id),
  wager        int not null check (wager >= 1 and wager <= 1000),
  -- Regular-season floor of 100 (and the sub-100 all-in exception) is enforced by the
  -- submit_pick transaction against live bankroll; overtime relaxes the floor to 1 (docs/05 #6).
  pick_type    pick_type not null default 'manual',
  is_ghost     boolean not null default false,    -- eliminated player's fun pick
  state        pick_state not null default 'draft',
  result       pick_result,
  submitted_at timestamptz,
  locked_at    timestamptz,
  settled_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (league_id, user_id, season, week)
);

create index picks_league_week on picks (league_id, season, week);

-- Overtime distinct wagers: no two non-ghost picks in the same overtime week may share a wager.
-- weeks.is_overtime is denormalized onto the pick path via this partial unique index on a
-- helper column maintained by trigger (simplest reliable enforcement in PG).
alter table picks add column is_overtime boolean not null default false;
create unique index picks_ot_distinct_wager
  on picks (league_id, season, week, wager)
  where is_overtime and not is_ghost;

create or replace function set_pick_overtime() returns trigger
language plpgsql as $$
begin
  select w.is_overtime into new.is_overtime
  from weeks w
  where w.league_id = new.league_id and w.season = new.season and w.week = new.week;
  new.is_overtime := coalesce(new.is_overtime, false);
  return new;
end $$;

create trigger picks_set_overtime
  before insert or update of league_id, season, week on picks
  for each row execute function set_pick_overtime();

-- ============================================================ ledger (bankroll truth)

create table ledger (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references leagues(id),
  user_id         uuid not null references users(id),
  pick_id         uuid references picks(id),
  entry_type      ledger_entry_type not null,
  amount          int not null,             -- signed; win +wager, loss -wager, push 0
  bankroll_before int not null check (bankroll_before >= 0),
  bankroll_after  int not null check (bankroll_after >= 0),
  idempotency_key text not null unique,     -- e.g. 'settle:{pick_id}' 'start:{league}:{user}'
  reason          text,
  created_at      timestamptz not null default now(),
  check (bankroll_after = bankroll_before + amount)
);

create index ledger_user on ledger (league_id, user_id, created_at);

-- ============================================================ standings snapshots

create table standings_snapshots (
  league_id  uuid not null references leagues(id),
  season     int not null,
  week       int not null,
  user_id    uuid not null references users(id),
  rank       int not null,
  bankroll   int not null,
  wins       int not null,
  losses     int not null,
  created_at timestamptz not null default now(),
  primary key (league_id, season, week, user_id)
);

-- ============================================================ chat

create table chat_messages (
  id                  uuid primary key default gen_random_uuid(),
  league_id           uuid not null references leagues(id),
  user_id             uuid not null references users(id),
  body                text not null check (char_length(body) between 1 and 2000),
  created_at          timestamptz not null default now(),
  deleted_by_admin_at timestamptz
);

create index chat_messages_league_time on chat_messages (league_id, created_at desc);

-- ============================================================ audit log (every admin mutation)

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references users(id),
  action        text not null,
  entity        text not null,
  entity_id     text not null,
  before        jsonb,
  after         jsonb,
  reason        text,
  created_at    timestamptz not null default now()
);

create index audit_log_entity on audit_log (entity, entity_id);

-- ============================================================ Row Level Security
-- The Next.js server uses the service-role key (bypasses RLS). RLS exists to make the
-- crown jewels — pre-reveal picks — and direct client access safe by default.

alter table users               enable row level security;
alter table leagues             enable row level security;
alter table league_members      enable row level security;
alter table nfl_teams           enable row level security;
alter table nfl_games           enable row level security;
alter table weeks               enable row level security;
alter table picks               enable row level security;
alter table ledger              enable row level security;
alter table standings_snapshots enable row level security;
alter table chat_messages       enable row level security;
alter table audit_log           enable row level security;

-- Public reference data is readable by any authenticated client.
create policy nfl_teams_read on nfl_teams for select to authenticated using (true);
create policy nfl_games_read on nfl_games for select to authenticated using (true);
create policy weeks_read     on weeks     for select to authenticated using (true);

-- Chat: members read; posting goes through the server (mute + membership checks), so no
-- insert policy for clients. Realtime subscription only needs select.
create policy chat_read on chat_messages for select to authenticated using (true);

-- Picks: deny-by-default. No client policy at all pre-beta; all pick reads flow through
-- server routes which enforce the reveal rule. (Adding a post-reveal read policy later is
-- one migration.) Everything else (users, ledger, audit, standings) is server-only too.

-- ============================================================ helpful view

create view current_standings as
select lm.league_id,
       lm.user_id,
       u.first_name,
       u.last_name,
       u.status,
       lm.bankroll,
       rank() over (partition by lm.league_id order by lm.bankroll desc) as rank
from league_members lm
join users u on u.id = lm.user_id
where u.status in ('active', 'eliminated');
