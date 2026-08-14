"use client";

/* eslint-disable react-hooks/refs -- ref reads happen only inside event
   handlers (toolbar clicks / input events), never during render; the
   compiler lint can't see through the shared closures. */

import { useRef } from "react";

/**
 * Minimal WYSIWYG for commissioner content: headers, bold/italic/underline,
 * bulleted + numbered lists, brand color swatches. Emits HTML into a hidden
 * form input; the server action sanitizes through an allowlist before saving
 * (src/lib/sanitize.ts), so this editor only needs to be convenient, not safe.
 */

const SWATCHES = [
  { label: "Gold", hex: "#E5A33D", cls: "bg-gold" },
  { label: "Purple", hex: "#6B3FA0", cls: "bg-brand-purple" },
  { label: "Orange", hex: "#E24A2E", cls: "bg-loss" },
  { label: "Teal", hex: "#1F7A6D", cls: "bg-win" },
  { label: "Default", hex: "#F4F6FA", cls: "bg-ink" },
];

export default function RichEditor({
  name,
  initialHtml,
}: {
  name: string;
  initialHtml: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sync = () => {
    if (inputRef.current && editorRef.current) {
      inputRef.current.value = editorRef.current.innerHTML;
    }
  };

  const cmd = (command: string, value?: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    sync();
  };

  const btn =
    "rounded-md border border-edge px-2 py-1 text-xs text-ink-muted transition hover:border-gold hover:text-ink";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} onMouseDown={cmd("formatBlock", "<h2>")}>H2</button>
        <button type="button" className={btn} onMouseDown={cmd("formatBlock", "<h3>")}>H3</button>
        <button type="button" className={btn} onMouseDown={cmd("formatBlock", "<p>")}>¶</button>
        <span className="mx-1 h-4 w-px bg-edge" />
        <button type="button" className={`${btn} font-bold`} onMouseDown={cmd("bold")}>B</button>
        <button type="button" className={`${btn} italic`} onMouseDown={cmd("italic")}>I</button>
        <button type="button" className={`${btn} underline`} onMouseDown={cmd("underline")}>U</button>
        <span className="mx-1 h-4 w-px bg-edge" />
        <button type="button" className={btn} onMouseDown={cmd("insertUnorderedList")}>• list</button>
        <button type="button" className={btn} onMouseDown={cmd("insertOrderedList")}>1. list</button>
        <span className="mx-1 h-4 w-px bg-edge" />
        {SWATCHES.map((s) => (
          <button
            key={s.label}
            type="button"
            title={s.label}
            aria-label={`Color: ${s.label}`}
            onMouseDown={cmd("foreColor", s.hex)}
            className={`h-5 w-5 rounded-full border border-edge ${s.cls} transition hover:scale-110`}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-edge" />
        <button type="button" className={btn} onMouseDown={cmd("removeFormat")}>
          clear
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        className="rich min-h-44 rounded-xl border border-edge bg-surface-raised/70 px-4 py-3 text-sm leading-relaxed outline-none focus:border-gold"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
      <input ref={inputRef} type="hidden" name={name} defaultValue={initialHtml} />
      <p className="mt-1.5 text-[11px] text-ink-muted/70">
        Formatting is filtered to headers, bold/italic/underline, lists, and the
        brand colors on save — pasted junk gets cleaned automatically.
      </p>
    </div>
  );
}
