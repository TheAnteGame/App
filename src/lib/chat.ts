import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID } from "@/lib/constants";
import type { AppUser } from "@/lib/db";

/**
 * Table Talk (docs/01 Page 4): one league-wide channel. Reads may flow through
 * Supabase Realtime with the Clerk JWT (decision #17); WRITES always come
 * through here — membership + mute enforced server-side, never client-side.
 */

export type ChatMessage = {
  id: string;
  userId: string;
  name: string;
  eliminated: boolean;
  body: string;
  createdAt: string;
};

export async function recentMessages(limit = 60): Promise<ChatMessage[]> {
  const db = supabaseAdmin();
  const [{ data: msgs }, { data: users }] = await Promise.all([
    db
      .from("chat_messages")
      .select("id, user_id, body, created_at")
      .eq("league_id", BETA_LEAGUE_ID)
      .is("deleted_by_admin_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    db.from("users").select("id, first_name, last_name, status"),
  ]);
  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  return (msgs ?? [])
    .reverse()
    .map((m) => {
      const u = userById.get(m.user_id);
      return {
        id: m.id,
        userId: m.user_id,
        name: u ? `${u.first_name ?? "?"} ${(u.last_name ?? "?")[0] ?? ""}.` : "?",
        eliminated: u?.status === "eliminated",
        body: m.body,
        createdAt: m.created_at,
      };
    });
}

export type PostResult = { ok: true } | { ok: false; error: string };

export async function postMessage(user: AppUser, body: string): Promise<PostResult> {
  if (user.status !== "active" && user.status !== "eliminated")
    return { ok: false, error: "Your seat isn't active." };
  if (user.muted_at) return { ok: false, error: "You've been muted by the commish." };
  const text = body.trim();
  if (!text) return { ok: false, error: "Say something first." };
  if (text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };

  const db = supabaseAdmin();
  // Membership check (ghosts stay members — full chat access per docs/02 §7).
  const { data: member } = await db
    .from("league_members")
    .select("user_id")
    .eq("league_id", BETA_LEAGUE_ID)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return { ok: false, error: "You don't have a seat at this table." };

  const { error } = await db.from("chat_messages").insert({
    league_id: BETA_LEAGUE_ID,
    user_id: user.id,
    body: text,
  });
  if (error) return { ok: false, error: "Couldn't post — try again." };
  return { ok: true };
}
