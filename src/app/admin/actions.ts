"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { requireUser, approveUser, type AppUser } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID, SEASON } from "@/lib/constants";
import { lockWeekJob, settleGamesJob } from "@/lib/jobs";
import { syncSchedule } from "@/lib/nfl/sync";

/**
 * Commissioner actions (spec §11). Every mutation is role-gated AND
 * audit-logged with before/after + reason + actor — admin corrections never
 * overwrite silently (CLAUDE.md hard rule).
 */

async function requireAdmin(): Promise<AppUser | null> {
  const user = await requireUser();
  return user && user.role === "admin" ? user : null;
}

async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason: string,
) {
  await supabaseAdmin().from("audit_log").insert({
    actor_user_id: actorId,
    action,
    entity,
    entity_id: entityId,
    before,
    after,
    reason,
  });
}

export async function approve(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return;
  await approveUser(String(formData.get("userId")), actor.id);
  revalidatePath("/admin");
}

export async function decline(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return;
  const userId = String(formData.get("userId"));
  const db = supabaseAdmin();
  const { data: before } = await db.from("users").select("*").eq("id", userId).single();
  if (!before || before.status !== "pending") return; // pending seats only
  await db.from("users").update({ status: "removed" }).eq("id", userId);
  await audit(actor.id, "decline_user", "users", userId, before,
    { ...before, status: "removed" }, "Commissioner declined the seat request");
  revalidatePath("/admin");
}

/** Mute/unmute a player's Table Talk privileges. */
export async function toggleMute(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return;
  const userId = String(formData.get("userId"));
  const db = supabaseAdmin();
  const { data: before } = await db.from("users").select("*").eq("id", userId).single();
  if (!before) return;
  const mutedAt = before.muted_at ? null : new Date().toISOString();
  await db.from("users").update({ muted_at: mutedAt }).eq("id", userId);
  await audit(actor.id, mutedAt ? "mute_user" : "unmute_user", "users", userId, before,
    { ...before, muted_at: mutedAt },
    mutedAt ? "Muted by the commish" : "Table Talk privileges restored");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/** Hide a chat message (soft delete — original body stays in the row). */
export async function deleteChatMessage(formData: FormData) {
  const actor = await requireAdmin();
  if (!actor) return;
  const messageId = String(formData.get("messageId"));
  const db = supabaseAdmin();
  const { data: before } = await db.from("chat_messages").select("*").eq("id", messageId).single();
  if (!before || before.deleted_by_admin_at) return;
  const deletedAt = new Date().toISOString();
  await db.from("chat_messages").update({ deleted_by_admin_at: deletedAt }).eq("id", messageId);
  await audit(actor.id, "delete_chat_message", "chat_messages", messageId, before,
    { ...before, deleted_by_admin_at: deletedAt }, "Removed from Table Talk by the commish");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export type ActionResult = { ok: boolean; message: string };

/** Override a week's lock time. Input is interpreted in ET (league deadline TZ). */
export async function overrideLock(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, message: "Not authorized." };
  const week = Number(formData.get("week"));
  const localEt = String(formData.get("lockAtEt") ?? ""); // datetime-local string
  const reason = String(formData.get("reason") ?? "").trim();
  if (!week || !localEt) return { ok: false, message: "Week and new lock time are required." };
  if (!reason) return { ok: false, message: "A reason is required — it goes in the audit log." };

  const lockAt = fromZonedTime(localEt, "America/New_York");
  if (Number.isNaN(lockAt.getTime())) return { ok: false, message: "Couldn't parse that time." };

  const db = supabaseAdmin();
  const { data: before } = await db
    .from("weeks")
    .select("*")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("season", SEASON)
    .eq("week", week)
    .single();
  if (!before) return { ok: false, message: `Week ${week} not found.` };
  if (before.state !== "upcoming")
    return { ok: false, message: `Week ${week} is ${before.state} — lock can't move.` };

  const after = { ...before, lock_at: lockAt.toISOString(), lock_source: "admin_override" };
  await db
    .from("weeks")
    .update({ lock_at: lockAt.toISOString(), lock_source: "admin_override" })
    .eq("id", before.id);
  await audit(actor.id, "override_lock", "weeks", before.id, before, after, reason);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Week ${week} now locks ${lockAt.toLocaleString("en-US", { timeZone: "America/New_York" })} ET.`,
  };
}

/**
 * Correct a game result (spec §11). Allowed while no pick on the game is
 * settled — after settlement a correction needs a compensating ledger entry
 * (deliberately out of beta scope; the audit trail records the attempt).
 */
export async function correctResult(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, message: "Not authorized." };
  const gameId = String(formData.get("gameId"));
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));
  const outcome = String(formData.get("outcome")); // home | away | tie | not_final
  const reason = String(formData.get("reason") ?? "").trim();
  if (!gameId || !reason) return { ok: false, message: "Game and reason are required." };

  const db = supabaseAdmin();
  const { data: before } = await db.from("nfl_games").select("*").eq("id", gameId).single();
  if (!before) return { ok: false, message: "Game not found." };

  const { data: settledPicks } = await db
    .from("picks")
    .select("id")
    .eq("game_id", gameId)
    .eq("state", "settled")
    .limit(1);
  if ((settledPicks ?? []).length > 0) {
    await audit(actor.id, "correct_result_blocked", "nfl_games", gameId, before, before,
      `BLOCKED (picks already settled): ${reason}`);
    return {
      ok: false,
      message: "Picks on this game are already settled — reversal needs a manual ledger correction.",
    };
  }

  const patch =
    outcome === "not_final"
      ? { status: "in_progress", home_score: homeScore, away_score: awayScore, winner_team_id: null }
      : {
          status: "final",
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id:
            outcome === "home" ? before.home_team_id : outcome === "away" ? before.away_team_id : null,
        };
  await db.from("nfl_games").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", gameId);
  await audit(actor.id, "correct_result", "nfl_games", gameId, before, { ...before, ...patch }, reason);
  revalidatePath("/admin");
  return {
    ok: true,
    message:
      outcome === "not_final"
        ? "Game reopened as in-progress."
        : "Result corrected. Run settlement (without ESPN refresh) to apply it.",
  };
}

/**
 * Give the commissioner their own seat (league membership + starting-balance
 * ledger). Exists because the original admin account was seeded pre-approval
 * flow and never got a seat — without one, chat and antes are correctly
 * refused. Idempotent; audit-logged.
 */
export async function seatSelf(): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, message: "Not authorized." };
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("league_members")
    .select("user_id")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("user_id", actor.id)
    .maybeSingle();
  if (existing) return { ok: true, message: "You already have a seat." };

  await db.from("league_members").upsert(
    { league_id: BETA_LEAGUE_ID, user_id: actor.id, bankroll: 1000 },
    { onConflict: "league_id,user_id", ignoreDuplicates: true },
  );
  await db.from("ledger").upsert(
    {
      league_id: BETA_LEAGUE_ID,
      user_id: actor.id,
      entry_type: "starting_balance",
      amount: 1000,
      bankroll_before: 0,
      bankroll_after: 1000,
      idempotency_key: `start:${BETA_LEAGUE_ID}:${actor.id}`,
      reason: "Season starting balance (commissioner self-seat)",
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  await audit(actor.id, "seat_self", "league_members", actor.id, null,
    { league_id: BETA_LEAGUE_ID, user_id: actor.id, bankroll: 1000 },
    "Commissioner took their own seat");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true, message: "You've got a seat at the table — 1,000 on the felt." };
}

/** Run the lock job now (locks any due week, deals AUTO-ANTES, reveals). */
export async function runLockNow(): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, message: "Not authorized." };
  const r = await lockWeekJob();
  await audit(actor.id, "run_lock_week", "jobs", "lock-week", null, r, "Manual run from admin panel");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    ok: r.errors.length === 0,
    message: `Locked ${r.weeksLocked} week(s), dealt ${r.autoPicks} AUTO-ANTE(s).${
      r.errors.length ? ` Errors: ${r.errors.join("; ")}` : ""
    }`,
  };
}

/** Settle official finals now. refreshFirst pulls ESPN scores before settling. */
export async function runSettleNow(refreshFirst: boolean): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, message: "Not authorized." };
  let syncNote = "";
  if (refreshFirst) {
    const s = await syncSchedule(SEASON, Array.from({ length: 18 }, (_, i) => i + 1), BETA_LEAGUE_ID);
    syncNote = ` (refreshed ${s.gamesUpserted} games from ESPN)`;
  }
  const r = await settleGamesJob();
  await audit(actor.id, "run_settle_games", "jobs", "settle-games", null, { ...r, refreshFirst },
    "Manual run from admin panel");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return {
    ok: r.errors.length === 0,
    message: `Settled ${r.settled} pick(s), ${r.eliminated} elimination(s), closed ${r.weeksSettled} week(s)${syncNote}.${
      r.errors.length ? ` Errors: ${r.errors.join("; ")}` : ""
    }`,
  };
}
