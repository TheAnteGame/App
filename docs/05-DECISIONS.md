# The Ante — Decision Log

Every contradiction, gap, or edge case found while merging the spec doc and wireframes, with the resolution from the Aug 12, 2026 interview. Update this file whenever a rule or architecture decision changes — it's the "why" behind the other docs.

| # | Issue found | Resolution | Decided |
|---|---|---|---|
| 1 | Auth contradiction: spec §10 + wireframes said Clerk **email** OTP; spec §12 said Supabase **phone** OTP | **Clerk email OTP.** Phone is a stored profile field only | Robert, Aug 12 |
| 2 | NFL data source unnamed ("pdf provided" never attached) | **Automated feed + admin override**: ESPN public API normalized into internal `nfl_games`; admin can correct anything; manual entry is the fallback path | Robert, Aug 12 |
| 3 | Private league but nothing restricted signup | **Open signup + admin approval** (Pending state until commissioner approves) | Robert, Aug 12 |
| 4 | Spec sentence about eliminated players cut off mid-thought | **Ghost picks**: eliminated players keep making tracked, displayed, clearly-marked fun picks with no standings effect; full dashboard + chat access | Robert, Aug 12 |
| 5 | Reveal timing conflict: §3 said at lock; §7 implied when all submitted | **Early reveal**: reveal fires at lock time OR the moment all active players have submitted, whichever is first. Consequence accepted: picks are editable only until reveal, so an early full house finalizes everyone | Robert, Aug 12 |
| 6 | Overtime distinct-wager rule mathematically breaks when tied players (identical bankrolls by definition) are at/below 100 — forced duplicate all-ins | **Waive the 100-point floor in overtime** (min wager 1, max full bankroll). Distinct wagers always possible when bankroll ≥ number of tied players; true degenerate cases fall to the existing split-title fallback | Robert, Aug 12 |
| 7 | Phone number collected but nothing used it | **Store only** in beta; all notifications via email (Resend); no SMS provider | Robert, Aug 12 |
| 8 | Name/domain undecided | **Name: "The Ante"** — the ante is the forced weekly wager, sport-agnostic for future leagues, verb-rich for CTAs/copy. Full table vocabulary adopted (see spec): Ante Up, AUTO-ANTE, The Table, Table Talk, BUSTED, "Antes are in." Domain: Robert purchasing; registry-verified available at decision time: antepool.com, letsante.com, anteweekly.com. Avoided "NFL"/"gambling" in name/domain (trademark + legal-notice consistency). Adjacent product noted: "Ante Up" friendly-bets app — fine for free private beta, trademark search before any commercial launch. Logo: mock concepts by Claude, Robert finalizes | Robert, Aug 12 |
| 9 | Week 1, 2026 opens **Wednesday Sep 9** (Patriots at Seahawks), before the default Thursday 3 PM ET lock | Early-game exception is active from Week 1; `sync-schedule` computes lock from earliest kickoff automatically | Found in research, Aug 12 |

| 10 | Rules audit (Aug 12, post-Phase-1): code counted voided picks as NOT consuming team use; docs/02 §6 says use is preserved | **Docs take precedence**: ties AND voids consume the team use; admin ruling refunds case-by-case | Robert, Aug 12 |
| 11 | Docs silent on whether team-use limits bind ghost picks | **Ghosts play by the same rules**: max-2 and no-consecutive apply against the ghost's full history; shadow stack fixed at 1,000 with normal 100–1,000 antes | Claude default, Aug 12 (flag if wrong) |
| 12 | "Official final" ambiguity: ESPN sends state=post before its completed flag | **Strict reading**: settle only when ESPN reports post AND completed — otherwise keep waiting | Claude default, Aug 12 |
| 13 | OT wager ceiling: schema capped all wagers at 1,000, but docs/02 §8 says 1..full bankroll in overtime | Docs win: DB CHECK relaxed (migration 0004); engine caps OT antes at full bankroll; regular season unchanged (100–1,000) | Rules audit, Aug 12 |
| 14 | Phone optional in the profile form vs docs/02 §1 "signup collects … mobile phone" | Docs win: phone is now required at profile completion (still store-only, email-only notifications) | Rules audit, Aug 12 |
| 15 | docs/02 §4 said picks hidden "before lock" while also defining early reveal | Rulebook wording fixed: the privacy boundary is **reveal** (matches code and CLAUDE.md) | Rules audit, Aug 12 |

## Defaults set without a question (flag if any feel wrong)

Wagers are whole integers (any value 100–1,000). Robert is sole admin via a role flag (more admins later is one row update). Regular-season tie = PUSH with team use counted (already in spec §14). Chat is plain text, league-wide, admin mute, no reactions/DMs in beta. Timestamps UTC in storage, deadlines rendered America/New_York, schedule times in each viewer's local timezone. Dark FanDuel-style theme, mobile-first. Legal-notice acceptance is per-user, timestamped, required before first pick. "Prize" in beta = title/bragging rights (free league). Beta = one league; schema supports many. Auto-pick randomness is seeded per (user, week) so re-running the lock job can't change an assigned team.

## Standing cautions

The free beta avoids gambling classification by having no consideration (no entry fee). The planned **paid subscription changes that analysis** — get an Arizona attorney's read before charging anything. I'm not a lawyer and the legal-notice copy in the app is a placeholder until then.
