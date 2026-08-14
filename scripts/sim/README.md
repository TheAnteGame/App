# Simulated week harness (Phase 1 exit criterion)

A full lock → AUTO-ANTE → reveal → settle → standings cycle against the live
DB, with test data, fully reversible. SQL steps are pasted into the Supabase
SQL Editor; job steps run via the **run-job** GitHub Actions workflow
(Actions → run-job → Run workflow) or any client sending the CRON_SECRET
Bearer header.

Recommended: disable the `gameday-pinger` workflow first (Actions →
gameday-pinger → ⋯ → Disable workflow) so a scheduled sync doesn't overwrite
the fake finals mid-sim; re-enable it after cleanup.

| # | Step | How |
|---|------|-----|
| 1 | Seed test players, backdate Week 1 lock | paste `SIM-1-SETUP.sql` |
| 2 | Lock + AUTO-ANTE + reveal | run-job → `lock-week` |
| 3 | Mark Week 1 games official finals (home wins) | paste `SIM-3-FAKE-FINALS.sql` |
| 3b | Settle (skip ESPN refresh!) | run-job → `settle-games`, params `sync=0` |
| 3c | Verify: bankrolls reconcile, week settled, snapshot written | run-job → `reconcile` |
| 4 | Wipe sim data, restore bankrolls, reopen Week 1 | paste `SIM-4-CLEANUP.sql` |
| 4b | Restore real Week 1 games + lock time from ESPN | run-job → `sync-schedule`, params `week=1` |

Expected outcomes: `sim.win` 1000→1300 (win, +300), `sim.bust` 1000→0
(all-in loss, BUSTED, status `eliminated`), `sim.lazy` gets a seeded
AUTO-ANTE of 100 (win or lose by its game), every other active player gets an
AUTO-ANTE too (undone by cleanup), Week 1 ends `settled` with a standings
snapshot, and `reconcile` reports every cached bankroll equal to its ledger sum.
