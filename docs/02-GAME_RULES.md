# The Ante — Game Rules, Canonical (Beta V1)

This is the single source of truth for how the game plays. The in-app "How to Play" page is generated from this document. Where the original spec doc and wireframes disagreed, the resolution recorded in `05-DECISIONS.md` is reflected here.

## 1. Joining

Signup is open at the site, but every account sits in **Pending** until the admin approves it (private league). Signup collects first name, last name, email, and mobile phone. Login is passwordless: enter email → 6-digit one-time code (Clerk) → in. Phone is stored for future use only; all beta notifications are email (Resend). Before making a first pick, a player must read the How to Play page and press **Accept** (acceptance is timestamped) — this covers the rules and the legal notice that this is a free-to-enter game of skill, not gambling (no buy-in, no rebuys, no cash consideration in the beta).

## 2. Bankroll and wagers

Every approved player starts the season with **1,000 points**. Each regular-season week (1–18) a player picks **exactly one NFL team to win outright** — no spreads, props, parlays, or fantasy. The wager is an integer between **100 and 1,000 points**, never more than current bankroll. If bankroll is below 100, the player must wager the entire remaining bankroll. Win: wager added to bankroll. Loss: wager subtracted.

## 3. Team usage limits

Each NFL team may be used **at most twice** per player during the regular season, and never in **consecutive weeks**. The team inventory screen shows all 32 teams as 0/2, 1/2, or 2/2 with ineligible teams (used twice, used last week, or on bye) visibly disabled.

## 4. Lock, reveal, and privacy

Normal lock is **Thursday 3:00 PM Eastern** (`America/New_York`, never a fixed offset). If any game in the NFL week kicks off earlier than that, the lock moves to **before the first kickoff of that week** and the actual lock time is displayed prominently. (This applies immediately: Week 1 of 2026 opens on a **Wednesday**.) The admin may override a lock time before the week opens.

Before **reveal**, players can see standings and who has or hasn't submitted, but never other players' teams or wagers. A player may edit their own pick until reveal. **Reveal happens at lock time — or earlier, the moment every active player has submitted.** Once reveal fires, all picks and wagers are shown simultaneously and nothing can be edited through the player UI. Any later admin correction creates an audit record. *(Wording fixed Aug 12: the privacy boundary is reveal, not lock — an early reveal legitimately shows picks before the lock time.)*

## 5. Missed picks (auto-pick)

At lock, any active player without a submission gets an **automatic random eligible team** and a **100-point wager** (or their whole bankroll if under 100). Eligible means: playing that week, not used twice already by that player, and not that player's prior-week team. Auto-picks are labeled **AUTO-ANTE** everywhere and count normally toward usage, record, bankroll, and stats. (In table terms: if you don't ante, the house antes for you.)

## 6. Settlement and game edge cases

Only an **official final** result settles a wager — never an in-progress or provisional score. A regular-season **tie is a PUSH**: no points change, but the team use still counts. **Postponed/rescheduled** games: the pick carries with the game if it stays inside the same NFL week; otherwise admin review. **Canceled/voided** games: PUSH, wager restored, team use preserved unless the admin rules the game never constituted a playable selection (ruling is logged). During a data outage, wagers stay unsettled until an official result or admin resolution — the system never guesses.

## 7. Elimination

A bankroll of **0 eliminates** the player from title contention — no rebuys, no rescue points. Eliminated players stay in the league as **ghosts**: they can keep submitting weekly picks and shadow wagers for fun, which are tracked and displayed (clearly marked **BUSTED**) and feed the fun-stats/bragging-rights layer, but never affect standings or the championship. Ghosts keep full access to the dashboard, history, and chat.

## 8. Champion and Bankroll Overtime

Highest bankroll after Week 18 wins. If first place is tied, tied players (only) enter **Bankroll Overtime** on Wild Card Weekend with their existing bankrolls, continuing through the Divisional Round, Conference Championships, and Super Bowl as needed. Each overtime round: pick one team to win outright from that round's games (admin loads matchups when known). Regular-season team-use limits do not apply in overtime.

Each tied player's wager must be **different from every other tied player's** that round — the app enforces distinctness. To make that always possible, **the 100-point minimum is waived in overtime**: wagers may be any integer from 1 to full bankroll. If a push/void or a truly degenerate case (bankroll smaller than the number of tied players) still leaves first place tied after the Super Bowl, the title is **shared equally** — no undefined end state.

## 9. Prize

Beta prize is the title and bragging rights (free league, no money). The stats layer — weekly superlatives, season records, scenario callouts — exists to make every week a story, not to affect scoring.
