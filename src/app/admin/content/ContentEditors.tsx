"use client";

import { useActionState } from "react";
import RichEditor from "@/components/RichEditor";
import type { TickerItem } from "@/lib/content";
import {
  saveTextGroup,
  saveRichSection,
  resetContent,
  addTickerItem,
  updateTickerItem,
  deleteTickerItem,
  type ContentActionResult,
} from "./actions";

/** Client widgets for /admin/content. Server actions do the real work. */

function Result({ r }: { r: ContentActionResult | null }) {
  if (!r) return null;
  return <p className={`mt-2 text-xs ${r.ok ? "text-win" : "text-loss"}`}>{r.message}</p>;
}

const inputCls =
  "w-full rounded-lg border border-edge bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-gold";

const COLOR_DOT: Record<string, string> = {
  gold: "bg-gold",
  purple: "bg-brand-purple",
  orange: "bg-loss",
  teal: "bg-win",
  muted: "bg-ink-muted",
};

export function ResetButton({ target, label }: { target: string; label: string }) {
  const [result, action, pending] = useActionState(resetContent, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="target" value={target} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] text-ink-muted underline-offset-2 hover:text-loss hover:underline disabled:opacity-40"
      >
        {label}
      </button>
      <Result r={result} />
    </form>
  );
}

export function TextGroupForm({
  fields,
}: {
  fields: { key: string; label: string; value: string; multiline?: boolean }[];
}) {
  const [result, action, pending] = useActionState(saveTextGroup, null);
  return (
    <form action={action} className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block text-xs text-ink-muted">
          <span className="mb-1 block uppercase tracking-wide">{f.label}</span>
          {f.multiline ? (
            <textarea name={`content:${f.key}`} defaultValue={f.value} rows={3} className={inputCls} />
          ) : (
            <input name={`content:${f.key}`} defaultValue={f.value} className={inputCls} />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="display rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <Result r={result} />
    </form>
  );
}

export function RichSectionForm({
  contentKey,
  initialHtml,
}: {
  contentKey: string;
  initialHtml: string;
}) {
  const [result, action, pending] = useActionState(saveRichSection, null);
  return (
    <form action={action}>
      <input type="hidden" name="key" value={contentKey} />
      <RichEditor name="html" initialHtml={initialHtml} />
      <div className="mt-2 flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="display rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save section"}
        </button>
        <Result r={result} />
      </div>
    </form>
  );
}

const COLORS = ["gold", "purple", "orange", "teal", "muted"] as const;

function ColorSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className={`${inputCls} w-28`}>
      {COLORS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function TickerAddForm() {
  const [result, action, pending] = useActionState(addTickerItem, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="min-w-56 flex-1 text-xs text-ink-muted">
        <span className="mb-1 block uppercase tracking-wide">New notice</span>
        <input name="text" maxLength={200} placeholder="e.g. Playoffs bracket night is Jan 10 — bring snacks" className={inputCls} />
      </label>
      <label className="text-xs text-ink-muted">
        <span className="mb-1 block uppercase tracking-wide">Color</span>
        <ColorSelect name="color" defaultValue="gold" />
      </label>
      <label className="w-20 text-xs text-ink-muted">
        <span className="mb-1 block uppercase tracking-wide">Order</span>
        <input name="position" type="number" defaultValue={0} className={inputCls} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="display rounded-lg bg-gold px-4 py-2 text-sm font-bold uppercase text-surface hover:bg-gold-bright disabled:opacity-40"
      >
        Add
      </button>
      <div className="w-full">
        <Result r={result} />
      </div>
    </form>
  );
}

function TickerRow({ item }: { item: TickerItem }) {
  const [updateResult, updateAction, updating] = useActionState(updateTickerItem, null);
  const [deleteResult, deleteAction, deleting] = useActionState(deleteTickerItem, null);
  return (
    <div className="rounded-xl border border-edge/70 bg-surface-raised/40 px-3 py-2.5">
      <form action={updateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={item.id} />
        <span className={`h-3 w-3 shrink-0 rounded-full ${COLOR_DOT[item.color]}`} aria-hidden="true" />
        <input name="text" defaultValue={item.text} maxLength={200} className={`${inputCls} min-w-48 flex-1`} />
        <ColorSelect name="color" defaultValue={item.color} />
        <input name="position" type="number" defaultValue={item.position} className={`${inputCls} w-16`} title="Order" />
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <input type="checkbox" name="active" defaultChecked={item.active} className="accent-[#E5A33D]" />
          live
        </label>
        <button
          type="submit"
          disabled={updating}
          className="rounded-lg border border-gold/50 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
        >
          Save
        </button>
      </form>
      <div className="mt-1 flex items-center gap-3">
        <form action={deleteAction}>
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" disabled={deleting} className="text-[11px] text-loss underline-offset-2 hover:underline disabled:opacity-40">
            Delete
          </button>
        </form>
        <Result r={updateResult} />
        <Result r={deleteResult} />
      </div>
    </div>
  );
}

export function TickerManager({ items }: { items: TickerItem[] }) {
  return (
    <div className="space-y-2">
      <TickerAddForm />
      {items.length === 0 && (
        <p className="text-sm text-ink-muted">
          No custom notices yet — the ticker runs on the automatic scenario
          callouts until you add some.
        </p>
      )}
      {items.map((i) => (
        <TickerRow key={i.id} item={i} />
      ))}
    </div>
  );
}
