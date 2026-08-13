"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/server";
import { BETA_LEAGUE_ID } from "@/lib/constants";
import { CONTENT_DEFAULTS, type ContentKey } from "@/lib/content";
import { sanitizeRichHtml, sanitizePlainText } from "@/lib/sanitize";

/** Commissioner content actions — role-gated, sanitized, audit-logged. */

export type ContentActionResult = { ok: boolean; message: string };

const EDITED_PATHS = ["/", "/welcome", "/how-to-play", "/dashboard", "/admin/content"];

async function requireAdminId(): Promise<string | null> {
  const u = await requireUser();
  return u && u.role === "admin" ? u.id : null;
}

async function audit(actorId: string, action: string, entityId: string, after: unknown, reason: string) {
  await supabaseAdmin().from("audit_log").insert({
    actor_user_id: actorId,
    action,
    entity: "site_content",
    entity_id: entityId,
    before: null,
    after,
    reason,
  });
}

function revalidateAll() {
  for (const p of EDITED_PATHS) revalidatePath(p);
}

/**
 * Save a group of plain-text fields. Inputs are named `content:<key>`;
 * only known keys are accepted, values are tag-stripped.
 */
export async function saveTextGroup(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const db = supabaseAdmin();

  const saved: string[] = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("content:") || typeof raw !== "string") continue;
    const key = name.slice("content:".length);
    if (!(key in CONTENT_DEFAULTS) || key.endsWith("Html")) continue;
    const value = sanitizePlainText(raw);
    if (!value) continue;
    if (value === CONTENT_DEFAULTS[key as ContentKey]) {
      await db.from("site_content").delete().eq("key", key); // back to default
    } else {
      const { error } = await db.from("site_content").upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: actorId,
      });
      if (error)
        return { ok: false, message: "Couldn't save — is migration 0006 applied in Supabase?" };
    }
    saved.push(key);
  }
  if (saved.length === 0) return { ok: false, message: "Nothing to save." };
  await audit(actorId, "update_site_text", saved.join(","), { keys: saved }, "Commissioner edited site text");
  revalidateAll();
  return { ok: true, message: `Saved ${saved.length} field${saved.length > 1 ? "s" : ""}.` };
}

/** Save one rich-HTML section (sanitized through the allowlist). */
export async function saveRichSection(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const key = String(formData.get("key") ?? "");
  const raw = String(formData.get("html") ?? "");
  if (!(key in CONTENT_DEFAULTS) || !key.endsWith("Html"))
    return { ok: false, message: "Unknown section." };

  const clean = sanitizeRichHtml(raw);
  if (!clean) return { ok: false, message: "That section can't be empty." };
  const { error } = await supabaseAdmin().from("site_content").upsert({
    key,
    value: clean,
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  });
  if (error)
    return { ok: false, message: "Couldn't save — is migration 0006 applied in Supabase?" };
  await audit(actorId, "update_site_section", key, { length: clean.length }, "Commissioner edited a rich section");
  revalidateAll();
  return { ok: true, message: "Section saved and live." };
}

/** Reset one key (or a whole prefix group) back to the shipped default. */
export async function resetContent(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const target = String(formData.get("target") ?? "");
  if (!target) return { ok: false, message: "Nothing to reset." };
  const keys = Object.keys(CONTENT_DEFAULTS).filter(
    (k) => k === target || k.startsWith(`${target}.`),
  );
  if (keys.length === 0) return { ok: false, message: "Unknown target." };
  await supabaseAdmin().from("site_content").delete().in("key", keys);
  await audit(actorId, "reset_site_content", target, { keys }, "Commissioner reset to defaults");
  revalidateAll();
  return { ok: true, message: "Back to the shipped copy." };
}

// ---------------- Ticker items ----------------

const TICKER_COLORS = new Set(["gold", "purple", "orange", "teal", "muted"]);

export async function addTickerItem(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const text = sanitizePlainText(String(formData.get("text") ?? ""), 200);
  const color = String(formData.get("color") ?? "gold");
  const position = Number(formData.get("position") ?? 0) || 0;
  if (!text) return { ok: false, message: "Write the notice first." };
  if (!TICKER_COLORS.has(color)) return { ok: false, message: "Pick a valid color." };

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("ticker_items")
    .insert({ league_id: BETA_LEAGUE_ID, text, color, position })
    .select("id")
    .single();
  if (error) return { ok: false, message: "Couldn't add it — is migration 0006 applied?" };
  await audit(actorId, "add_ticker_item", data.id, { text, color, position }, "Commissioner added a ticker notice");
  revalidateAll();
  return { ok: true, message: "On the ticker." };
}

export async function updateTickerItem(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const id = String(formData.get("id") ?? "");
  const text = sanitizePlainText(String(formData.get("text") ?? ""), 200);
  const color = String(formData.get("color") ?? "gold");
  const position = Number(formData.get("position") ?? 0) || 0;
  const active = formData.get("active") === "on";
  if (!id || !text) return { ok: false, message: "Nothing to update." };
  if (!TICKER_COLORS.has(color)) return { ok: false, message: "Pick a valid color." };

  await supabaseAdmin()
    .from("ticker_items")
    .update({ text, color, position, active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("league_id", BETA_LEAGUE_ID);
  await audit(actorId, "update_ticker_item", id, { text, color, position, active }, "Commissioner edited a ticker notice");
  revalidateAll();
  return { ok: true, message: "Updated." };
}

export async function deleteTickerItem(
  _prev: ContentActionResult | null,
  formData: FormData,
): Promise<ContentActionResult> {
  const actorId = await requireAdminId();
  if (!actorId) return { ok: false, message: "Not authorized." };
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Nothing to delete." };
  await supabaseAdmin().from("ticker_items").delete().eq("id", id).eq("league_id", BETA_LEAGUE_ID);
  await audit(actorId, "delete_ticker_item", id, null, "Commissioner removed a ticker notice");
  revalidateAll();
  return { ok: true, message: "Gone." };
}
