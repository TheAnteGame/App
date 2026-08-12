# The Ante — Product Spec: Pages, Flows, Features (Beta V1)

Merges the original spec doc, the four wireframe pages, and the interview decisions into one build target. Game mechanics live in `02-GAME_RULES.md`; technical detail in `03-ARCHITECTURE.md`.

## Design language

FanDuel-adjacent: dark surface, high contrast, one sharp accent color, big numbers, clean cards. **Mobile-first** — most players will pick and trash-talk from their phones — but fully usable on desktop. Smooth form/field transitions (the wireframes call this out twice): animated step transitions on login/signup, optimistic UI on pick submission, skeleton loaders instead of spinners where possible. Name is decided (**The Ante**); logo and domain are in progress, so keep name/logo as swappable tokens in code anyway.

### Brand voice — the table vocabulary

The whole app speaks poker-table language. Canonical terms (use these in UI copy, emails, and notifications; mechanic names in the database stay generic):

| Concept | In-app language |
|---|---|
| Submit pick + wager | **Ante Up** (button), "your ante's in" |
| Weekly deadline | "Antes due Thursday 3:00 PM ET" |
| Missed-pick auto assignment | **AUTO-ANTE** badge |
| Reveal moment | **"Antes are in."** |
| Leaderboard | **The Table** |
| League chat | **Table Talk** (admin mute = losing table-talk privileges) |
| Bankroll (flavor) | your **stack** ("bankroll" stays the formal rules term) |
| Elimination | **BUSTED** badge; ghosts remain "at the table" |
| Signup → approval | "Take a seat" → "You've got a seat at the table" |
| Raising your wager | "upping the ante" (scenario callouts) |
| Champion | "Last stack standing" |

## Page 1 — Sign Up / Login (wireframe 1)

Centered single column: logo, 2–3 sentence intro for new players, one **email field with inline fine print** (consent/legal one-liner), submit arrow. Clerk email OTP drives everything: existing users get a code and go straight to the dashboard; new emails continue to profile completion. Copyright line at the bottom. No password anywhere.

## Page 2 — Profile completion (wireframe 2, "after email entered")

Same logo and description for continuity. After the email is verified by OTP, the form slides to: **first name, last name, phone**, submit. Submitting creates the account in **Pending** state and shows a "you're in line — the commissioner will approve you" screen. Admin gets an email (Resend) on each new pending signup; player gets an email when approved. Pending users can log in but only see the How to Play page and their pending status.

## Page 3 — How to Play (wireframe 3)

Three stacked sections, scroll as needed: **How to Play** (short instructions distilled from `02-GAME_RULES.md`), **Detailed Rules** (the full canonical rules), **Legal Notices** (free-to-enter game of skill; no consideration; not gambling under Arizona law — final copy needs a real attorney pass before any paid tier). Right rail (stacks on mobile): **live list of currently registered players**, dynamic, scrolling inside its box when it overflows. **Accept** button at the bottom — required once per user before first pick; acceptance timestamped. Page stays reachable afterward from the nav (without the Accept gate).

## Page 4 — Player Dashboard (wireframe 4)

The home screen after login. Layout by region:

- **Header**: logo left; right side shows current rank #, points, player name, and a menu (account details, how-to-play, logout).
- **Weekly Ante card** (top-left, the money spot): current NFL week, prominent **lock countdown** with the actual lock time ("Antes due …"), and the pick flow — choose eligible team → enter wager (100–1,000, capped at bankroll) → validate → confirm via the **Ante Up** button → submitted. Shows the player's own submitted pick/wager pre-reveal with an Edit affordance until reveal. After reveal it flips to the revealed weekly board. After settlement it shows the result and new bankroll. Potential outcomes always visible once submitted: bankroll-if-win / bankroll-if-lose.
- **Notices ticker** (under the wager card): league notes and scenario callouts animated like a news ticker — "X can take the lead," "Y is ALL-IN," "Z risks elimination," "biggest possible mover," etc. All callouts are deterministic, computed from standings + revealed wagers, never hand-entered.
- **The Table** (leaderboard, top-right): rank, name, bankroll, W-L, submission status (anted/waiting pre-lock — never the pick itself), status badges (BUSTED ghosts shown memorialized at the bottom). Weekly updated with newest leaders; **sortable views** for other leaderboards — e.g., biggest weekly win, most correct picks, riskiest player.
- **Team Inventory** (mid-left): all 32 teams, 0/2–2/2 usage pips, disabled states for used-twice / last week's team / bye. Tapping a team opens its full season schedule with results and that player's remaining uses.
- **Table Talk** (league chat, mid-right): one league-wide text channel (Supabase Realtime), all players + ghosts can post; admin can **mute** players (muted users see the chat but can't post; a small "muted by the commish" state). Simple text only for beta.
- **Below the fold**: full sortable **NFL schedule** (Weeks 1–18: teams, home/away, date/time in the viewer's timezone, byes, status, final scores), **week history** (any past week: picks, wagers, AUTO-ANTE flags, results, bankroll deltas, post-week rankings), and the **fun stats** panels (weekly superlatives + season records per the stats list in the rules doc).

## Reveal behavior

Pre-lock the weekly board shows only submission checkmarks. The moment reveal fires (lock time, or early when all active players are in), the screen leads with **"Antes are in."** and the board flips to: player, team, wager, current bankroll, potential win/loss bankrolls, and live game status → final result. This flip is the weekly dopamine moment — make it feel like a card flip, with the notices ticker refreshing scenario callouts immediately.

## Admin panel (no wireframe; from spec §11)

Separate `/admin` area, role-gated. Capabilities: approve/remove players (approve is the beta's front door); view submission status (names only pre-lock — **picks stay hidden from admin UI until reveal**); set/override next week's lock time; open/close weeks; review auto-picks; enter/correct results and settle games (with reason, preserving original values — full audit trail); manage matchups for Bankroll Overtime rounds; mute/unmute chat users; view eliminated players; inspect audit logs; simple CRM view of all players (the spec's "CRM within our newly built system"); "mark payments" exists as a stubbed field for the future paid tier, unused in beta.

## Emails (Resend)

Signup confirmation (via Clerk OTP), approval notice ("You've got a seat at the table"), weekly "Ante up — Week N is open" note, reminder to non-submitters ("Your ante's due in 3 hours"; Wed evening + ~3 hours before lock), "Antes are in" reveal summary at lock, and a weekly results/standings recap Tuesday morning with a couple of fun stats. All transactional; no marketing.

## Out of scope for beta (design doesn't preclude them)

Multiple leagues (schema supports it, UI assumes one), paid subscriptions/payments, SMS anything, native apps, push notifications, avatars/reactions in chat, public marketing site.
