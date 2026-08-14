/**
 * Allowlist HTML sanitizer for commissioner-edited rich content. Pure — no
 * DOM, no deps — so it runs in server actions and is unit-testable.
 *
 * Kept tags: p h2 h3 strong em u ul ol li br span a(→span, links stripped).
 * Mapped: b→strong, i→em, div→p, font→span.
 * Attributes: everything is dropped except a class naming one of the brand
 * color classes (c-gold / c-purple / c-orange / c-teal / c-muted). Inline
 * color styles and <font color> from the editor are translated to those
 * classes when they match the palette, otherwise removed.
 */

const KEEP = new Set(["p", "h2", "h3", "strong", "em", "u", "ul", "ol", "li", "br", "span"]);
const MAP: Record<string, string> = { b: "strong", i: "em", div: "p", font: "span", a: "span", h1: "h2", h4: "h3" };
const VOID = new Set(["br"]);
const COLOR_CLASSES = new Set(["c-gold", "c-purple", "c-orange", "c-teal", "c-muted"]);

/** Palette lookup: hex/rgb → brand class. */
const PALETTE: [RegExp, string][] = [
  [/#e5a33d|#f5c15d|rgb\(\s*229\s*,\s*163\s*,\s*61\s*\)|rgb\(\s*245\s*,\s*193\s*,\s*93\s*\)/i, "c-gold"],
  [/#6b3fa0|rgb\(\s*107\s*,\s*63\s*,\s*160\s*\)/i, "c-purple"],
  [/#e24a2e|rgb\(\s*226\s*,\s*74\s*,\s*46\s*\)/i, "c-orange"],
  [/#1f7a6d|rgb\(\s*31\s*,\s*122\s*,\s*109\s*\)/i, "c-teal"],
  [/#9aa5b5|rgb\(\s*154\s*,\s*165\s*,\s*181\s*\)/i, "c-muted"],
];

function colorClassFrom(attrs: string): string | null {
  const cls = attrs.match(/class\s*=\s*("([^"]*)"|'([^']*)')/i);
  if (cls) {
    const found = (cls[2] ?? cls[3] ?? "").split(/\s+/).find((c) => COLOR_CLASSES.has(c));
    if (found) return found;
  }
  const styleOrColor =
    attrs.match(/style\s*=\s*("[^"]*"|'[^']*')/i)?.[0] ?? attrs.match(/color\s*=\s*("[^"]*"|'[^']*')/i)?.[0] ?? "";
  for (const [re, klass] of PALETTE) if (re.test(styleOrColor)) return klass;
  return null;
}

const escapeText = (s: string) =>
  s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sanitizeRichHtml(input: string): string {
  let html = String(input ?? "").slice(0, 30000);
  // Drop script/style/comment blocks with their contents.
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, "");

  const tagRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let out = "";
  let last = 0;
  const open: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    out += escapeText(html.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === "/";
    let tag = m[2].toLowerCase();
    const attrs = m[3] ?? "";
    if (MAP[tag]) tag = MAP[tag];
    if (!KEEP.has(tag)) continue; // unknown tag: dropped, inner text survives
    if (VOID.has(tag)) {
      if (!closing) out += `<${tag}>`;
      continue;
    }
    if (closing) {
      // Close only if actually open (keeps output balanced).
      const idx = open.lastIndexOf(tag);
      if (idx !== -1) {
        // close any unclosed inner tags first
        while (open.length > idx) out += `</${open.pop()}>`;
      }
      continue;
    }
    const color = tag === "span" || tag === "p" || tag === "li" || tag === "strong" ? colorClassFrom(attrs) : colorClassFrom(attrs);
    out += color ? `<${tag} class="${color}">` : `<${tag}>`;
    open.push(tag);
  }
  out += escapeText(html.slice(last));
  while (open.length > 0) out += `</${open.pop()}>`;
  return out.trim();
}

/** Plain-text field sanitizer: strips tags entirely, collapses length. */
export function sanitizePlainText(input: string, max = 2000): string {
  return String(input ?? "")
    .replace(/<[^>]*>/g, "")
    .slice(0, max)
    .trim();
}
