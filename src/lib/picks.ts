import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON, WAGER_MIN, WAGER_MAX } from "@/lib/constants";
import { evaluateTeam } from "@/lib/engine/eligibility";
import { validateWager } from "@/lib/engine/wager";
import { eligibilityFor, toGameLite } from "@/lib/engine/context";
import { weekGames, memberContext, type AppUser } from "@/lib/db";

// Pure helpers live in the engine (testable, no server-only deps); re-export
// so existing imports keep working.
export { eligibilityFor, toGameLite } from "@/lib/engine/context";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Submit or edit a pick (docs/02 §2–4). Ghost picks (eliminated players) run
 * the same validations except bankroll (shadow wager vs a fixed 1000 cap).
 * All rules re-validated server-side; Postgres constraints are the backstop.
 */
export async function submitPick(
  user: AppUser,
  week: number,
  teamId: number,
  wager: number,
): Promise<SubmitResult> {
  const db = supabaseAdmin();

  if (!user.rules_accepted_at)
    return { ok: false, error: "Read the rules and press Accept before your first ante." };
  if (user.status === "pending" || user.status === "removed")
    return { ok: false, error: "Your seat isn't active." };
  const isGhost = user.status === "eliminated";

  const { data: weekRow } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("week", week)
    .maybeSingle();
  if (!weekRow) return { ok: false, error: "That week isn't set up yet." };
  if (!["upcoming", "open"].includes(weekRow.state))
    return { ok: false, error: "Antes are locked for this week." };
  if (new Date(weekRow.lock_at).getTime() <= Date.now())
    return { ok: false, error: "The lock has passed — antes are in." };

  const games = (await weekGames(week)).map(toGameLite);
  const { bankroll, picks: history } = await memberContext(user.id);

  // docs/02 §8: regular-season team-use limits do NOT apply in Bankroll
  // Overtime — only "plays this round" matters, so OT eligibility is computed
  // against an empty history.
  const isOvertime = Boolean(weekRow.is_overtime);
  const elig = evaluateTeam(
    teamId,
    eligibilityFor(week, games, isOvertime ? [] : history),
  );
  if (!elig.eligible) {
    const msg = {
      bye: "That team isn't playing this week.",
      used_max: "You've already used that team twice.",
      used_last_week: "No back-to-back weeks with the same team.",
      ok: "",
    }[elig.reason];
    return { ok: false, error: msg };
  }

  const effectiveBankroll = isGhost ? 1000 : bankroll ?? 0;
  const v = validateWager(wager, effectiveBankroll, {
    min: WAGER_MIN,
    max: WAGER_MAX,
    isOvertime,
  });
  if (!v.ok) return { ok: false, error: v.error };

  const { error } = await db.from("picks").upsert(
    {
      league_id: BETA_LEAGUE_ID,
      user_id: user.id,
      season: SEASON,
      week,
      team_id: teamId,
      game_id: elig.gameId,
      wager,
      pick_type: "manual",
      is_ghost: isGhost,
      state: "submitted",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "league_id,user_id,season,week" },
  );
  if (error) return { ok: false, error: "Couldn't save the pick — try again." };

  // Early reveal (docs/02 §4): the moment every ACTIVE player has submitted.
  await maybeEarlyReveal(weekRow.id, week);
  return { ok: true };
}

export async function maybeEarlyReveal(weekId: string, week: number) {
  const db = supabaseAdmin();
  const [{ data: actives }, { data: submitted }] = await Promise.all([
    db.from("users").select("id").eq("status", "active"),
    db
      .from("picks")
      .select("user_id")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("season", SEASON)
      .eq("week", week)
      .eq("state", "submitted")
      .eq("is_ghost", false),
  ]);
  const activeIds = new Set((actives ?? []).map((u) => u.id));
  if (activeIds.size === 0) return;
  const submittedIds = new Set((submitted ?? []).map((p) => p.user_id));
  for (const id of activeIds) if (!submittedIds.has(id)) return;

  // Everyone's in — flip it. Guard on state so repeated calls are no-ops.
  await db
    .from("weeks")
    .update({ state: "revealed", revealed_at: new Date().toISOString() })
    .eq("id", weekId)
    .in("state", ["upcoming", "open"]);
  await db
    .from("picks")
    .update({ state: "locked", locked_at: new Date().toISOString() })
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("week", week)
    .eq("state", "submitted");
}
