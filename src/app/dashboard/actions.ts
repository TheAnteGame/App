"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/db";
import { submitPick } from "@/lib/picks";

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
