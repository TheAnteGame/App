-- The Ante — commissioner-editable site content + custom ticker items.
-- site_content: key → value overrides for page copy (labels, placeholders,
--   and sanitized rich-HTML sections). Missing keys fall back to the defaults
--   compiled into the app, so this table can start empty.
-- ticker_items: commissioner-authored notices merged ahead of the computed
--   scenario callouts, with a brand accent color each.
-- Both are written ONLY through audit-logged admin server actions; RLS is
-- enabled with no client policies (server-only, service role).

create table site_content (
  key        text primary key,
  value      text not null check (char_length(value) <= 30000),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create table ticker_items (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references leagues(id),
  text       text not null check (char_length(text) between 1 and 200),
  color      text not null default 'gold'
             check (color in ('gold', 'purple', 'orange', 'teal', 'muted')),
  position   int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ticker_items_league on ticker_items (league_id, active, position);

alter table site_content enable row level security;
alter table ticker_items enable row level security;
