-- The Ante — seed: 32 NFL teams (stable internal IDs) + the beta league.
-- IDs are OURS: AFC East 1–4, AFC North 5–8, AFC South 9–12, AFC West 13–16,
-- NFC East 17–20, NFC North 21–24, NFC South 25–28, NFC West 29–32.

insert into nfl_teams (id, abbr, name, conference, division) values
  (1,  'BUF', 'Buffalo Bills',        'AFC', 'East'),
  (2,  'MIA', 'Miami Dolphins',       'AFC', 'East'),
  (3,  'NE',  'New England Patriots', 'AFC', 'East'),
  (4,  'NYJ', 'New York Jets',        'AFC', 'East'),
  (5,  'BAL', 'Baltimore Ravens',     'AFC', 'North'),
  (6,  'CIN', 'Cincinnati Bengals',   'AFC', 'North'),
  (7,  'CLE', 'Cleveland Browns',     'AFC', 'North'),
  (8,  'PIT', 'Pittsburgh Steelers',  'AFC', 'North'),
  (9,  'HOU', 'Houston Texans',       'AFC', 'South'),
  (10, 'IND', 'Indianapolis Colts',   'AFC', 'South'),
  (11, 'JAX', 'Jacksonville Jaguars', 'AFC', 'South'),
  (12, 'TEN', 'Tennessee Titans',     'AFC', 'South'),
  (13, 'DEN', 'Denver Broncos',       'AFC', 'West'),
  (14, 'KC',  'Kansas City Chiefs',   'AFC', 'West'),
  (15, 'LV',  'Las Vegas Raiders',    'AFC', 'West'),
  (16, 'LAC', 'Los Angeles Chargers', 'AFC', 'West'),
  (17, 'DAL', 'Dallas Cowboys',       'NFC', 'East'),
  (18, 'NYG', 'New York Giants',      'NFC', 'East'),
  (19, 'PHI', 'Philadelphia Eagles',  'NFC', 'East'),
  (20, 'WSH', 'Washington Commanders','NFC', 'East'),
  (21, 'CHI', 'Chicago Bears',        'NFC', 'North'),
  (22, 'DET', 'Detroit Lions',        'NFC', 'North'),
  (23, 'GB',  'Green Bay Packers',    'NFC', 'North'),
  (24, 'MIN', 'Minnesota Vikings',    'NFC', 'North'),
  (25, 'ATL', 'Atlanta Falcons',      'NFC', 'South'),
  (26, 'CAR', 'Carolina Panthers',    'NFC', 'South'),
  (27, 'NO',  'New Orleans Saints',   'NFC', 'South'),
  (28, 'TB',  'Tampa Bay Buccaneers', 'NFC', 'South'),
  (29, 'ARI', 'Arizona Cardinals',    'NFC', 'West'),
  (30, 'LAR', 'Los Angeles Rams',     'NFC', 'West'),
  (31, 'SF',  'San Francisco 49ers',  'NFC', 'West'),
  (32, 'SEA', 'Seattle Seahawks',     'NFC', 'West')
on conflict (id) do nothing;

-- The one beta league.
insert into leagues (id, name, season)
values ('00000000-0000-0000-0000-000000000001', 'The Ante — 2026', 2026)
on conflict (id) do nothing;
