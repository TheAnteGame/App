import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON, START_BANKROLL } from "@/lib/constants";
import { ledgerKeys } from "@/lib/engine/settle";

export type AppUser = {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: "player" | "admin";
  status: "pending" | "active" | "eliminated" | "removed";
  rules_accepted_at: string | null;
  muted_at: string | null;
};

/**
 * Lazy user provisioning: on any authenticated request, make sure a users row
 * exists for the Clerk identity (decision: no Clerk webhook in beta — this is
 * simpler and has no missed-event failure mode at 25 players).
 */
export async function requireUser(): Promise<AppUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  if (existing) return existing as AppUser;

  const cu = await currentUser();
  const email = cu?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return null;

  // Email may pre-exist (e.g. admin-seeded row) — link it to this Clerk id.
  const { data: byEmail } = await db
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (byEmail) {
    const { data } = await db
      .from("users")
      .update({ clerk_id: clerkId })
      .eq("id", byEmail.id)
      .select()
      .single();
    return data as AppUser;
  }

  const { data: created, error } = await db
    .from("users")
    .insert({ clerk_id: clerkId, email, status: "pending" })
    .select()
    .single();
  if (error) {
    // benign race: another request created it first
    const { data: raced } = await db
      .from("users")
      .select("*")
      .eq("clerk_id", clerkId)
      .maybeSingle();
    return (raced as AppUser) ?? null;
  }
  return created as AppUser;
}

export function profileComplete(u: AppUser): boolean {
  return Boolean(u.first_name && u.last_name);
}

/** Approve a player: activate, add to the beta league, write starting balance.
 *  Pending seats only — approving an eliminated/removed id must not resurrect them. */
export async function approveUser(userId: string, actorId: string) {
  const db = supabaseAdmin();
  const { data: before } = await db.from("users").select("*").eq("id", userId).single();
  if (!before || before.status !== "pending") return;
  await db.from("users").update({ status: "active" }).eq("id", userId);
  await db
    .from("league_members")
    .upsert(
      { league_id: BETA_LEAGUE_ID, user_id: userId, bankroll: START_BANKROLL },
      { onConflict: "league_id,user_id", ignoreDuplicates: true },
    );
  // idempotent starting-balance ledger entry
  await db.from("ledger").upsert(
    {
      league_id: BETA_LEAGUE_ID,
      user_id: userId,
      entry_type: "starting_balance",
      amount: START_BANKROLL,
      bankroll_before: 0,
      bankroll_after: START_BANKROLL,
      idempotency_key: ledgerKeys.startingBalance(BETA_LEAGUE_ID, userId),
      reason: "Season starting balance",
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  await db.from("audit_log").insert({
    actor_user_id: actorId,
    action: "approve_user",
    entity: "users",
    entity_id: userId,
    before,
    after: { ...before, status: "active" },
    reason: "Commissioner approval",
  });
}

/** The current (earliest non-settled) week row for the beta league. */
export async function currentWeek() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .in("state", ["upcoming", "open", "locked", "revealed"])
    .order("week", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function weekGames(week: number) {
  const db = supabaseAdmin();
  const { data } = await db
    .from("nfl_games")
    .select("*")
    .eq("season", SEASON)
    .eq("week", week)
    .order("kickoff_at", { ascending: true });
  return data ?? [];
}

/** A member's bankroll + prior pick history (for eligibility). */
export async function memberContext(userId: string) {
  const db = supabaseAdmin();
  const [{ data: member }, { data: picks }] = await Promise.all([
    db
      .from("league_members")
      .select("bankroll")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("picks")
      .select("week, team_id, wager, state, result, pick_type, is_ghost, game_id, id, submitted_at")
      .eq("league_id", BETA_LEAGUE_ID)
      .eq("user_id", userId)
      .eq("season", SEASON)
      .order("week", { ascending: true }),
  ]);
  return { bankroll: member?.bankroll ?? null, picks: picks ?? [] };
}

export async function standings() {
  const db = supabaseAdmin();
  const { data } = await db
    .from("current_standings")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .order("rank", { ascending: true });
  return data ?? [];
}

export async function allTeams() {
  const db = supabaseAdmin();
  const { data } = await db.from("nfl_teams").select("*").order("id");
  return data ?? [];
}
