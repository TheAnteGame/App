"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/db";
import { submitPick } from "@/lib/picks";
import { postMessage, recentMessages, type ChatMessage, type PostResult } from "@/lib/chat";

export type AnteFormState = { error: string | null; ok: boolean };

export async function anteUp(
  _prev: AnteFormState,
  formData: FormData,
): Promise<AnteFormState> {
  const user = await requireUser();
  if (!user) return { error: "Not signed in.", ok: false };

  const week = Number(formData.get("week"));
  const teamId = Number(formData.get("teamId"));
  const wager = Number(formData.get("wager"));
  if (!week || !teamId || !Number.isFinite(wager))
    return { error: "Pick a team and an ante first.", ok: false };

  const result = await submitPick(user, week, teamId, wager);
  if (!result.ok) return { error: result.error, ok: false };

  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

/** Table Talk: post (mute + membership enforced in lib/chat). */
export async function postChat(body: string): Promise<PostResult> {
  const user = await requireUser();
  if (!user) return { ok: false, error: "Not signed in." };
  return postMessage(user, body);
}

/** Table Talk: poll/refresh reads (also the Realtime event handler's fetch). */
export async function fetchChat(): Promise<ChatMessage[]> {
  const user = await requireUser();
  if (!user || user.status === "pending" || user.status === "removed") return [];
  return recentMessages();
}
