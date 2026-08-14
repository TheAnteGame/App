-- The Ante — enum "repair" (Aug 14) — HISTORICAL RECORD of applied DDL.
-- Context (incident, see CHANGELOG 2026-08-14): a parallel session reverted
-- the deployed CODE to a pre-0005 state; that stale code queried the dead
-- 'open' state that migration 0005_phase2_prep had deliberately removed. The
-- session misread the resulting error as a broken DATABASE and re-added every
-- 0001 enum value (each line no-ops if the value exists). Robert applied it,
-- so prod's week_state/pick_state now carry the dead values again ('open',
-- 'locked', 'draft'). This is HARMLESS — no code path ever writes them — and
-- re-shrinking is optional cleanup for a quiet week, not a requirement.
-- Kept (renamed 0007, its true position after 0006) because migrations must
-- record what actually ran against prod.

alter type user_role add value if not exists 'player';
alter type user_role add value if not exists 'admin';

alter type user_status add value if not exists 'pending';
alter type user_status add value if not exists 'active';
alter type user_status add value if not exists 'eliminated';
alter type user_status add value if not exists 'removed';

alter type game_status add value if not exists 'scheduled';
alter type game_status add value if not exists 'in_progress';
alter type game_status add value if not exists 'final';
alter type game_status add value if not exists 'postponed';
alter type game_status add value if not exists 'canceled';

alter type week_state add value if not exists 'upcoming';
alter type week_state add value if not exists 'open';
alter type week_state add value if not exists 'locked';
alter type week_state add value if not exists 'revealed';
alter type week_state add value if not exists 'settled';

alter type lock_source add value if not exists 'default';
alter type lock_source add value if not exists 'early_game';
alter type lock_source add value if not exists 'admin_override';

alter type ot_round add value if not exists 'wildcard';
alter type ot_round add value if not exists 'divisional';
alter type ot_round add value if not exists 'conference';
alter type ot_round add value if not exists 'superbowl';

alter type pick_type add value if not exists 'manual';
alter type pick_type add value if not exists 'auto';

alter type pick_state add value if not exists 'draft';
alter type pick_state add value if not exists 'submitted';
alter type pick_state add value if not exists 'locked';
alter type pick_state add value if not exists 'settled';

alter type pick_result add value if not exists 'win';
alter type pick_result add value if not exists 'loss';
alter type pick_result add value if not exists 'push';
alter type pick_result add value if not exists 'void';

alter type ledger_entry_type add value if not exists 'starting_balance';
alter type ledger_entry_type add value if not exists 'wager_win';
alter type ledger_entry_type add value if not exists 'wager_loss';
alter type ledger_entry_type add value if not exists 'push';
alter type ledger_entry_type add value if not exists 'admin_adjustment';
