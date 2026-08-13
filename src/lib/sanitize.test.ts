import { describe, it, expect } from "vitest";
import { sanitizeRichHtml, sanitizePlainText } from "./sanitize";

describe("sanitizeRichHtml", () => {
  it("keeps the allowed structural tags", () => {
    const html = "<h2>Rules</h2><p>One <strong>bold</strong> and <em>italic</em></p><ul><li>a</li><li>b</li></ul><ol><li>1</li></ol>";
    expect(sanitizeRichHtml(html)).toBe(html);
  });

  it("maps editor-flavored tags (b/i/div/font) to canonical ones", () => {
    expect(sanitizeRichHtml("<div><b>x</b> <i>y</i></div>")).toBe("<p><strong>x</strong> <em>y</em></p>");
  });

  it("strips scripts entirely, contents included", () => {
    expect(sanitizeRichHtml('<p>ok</p><script>alert("x")</script>')).toBe("<p>ok</p>");
  });

  it("drops event handlers and unknown attributes", () => {
    expect(sanitizeRichHtml('<p onclick="evil()" data-x="1">hi</p>')).toBe("<p>hi</p>");
  });

  it("translates palette colors (style or font) to brand classes", () => {
    expect(sanitizeRichHtml('<span style="color: #E5A33D">gold</span>')).toBe('<span class="c-gold">gold</span>');
    expect(sanitizeRichHtml('<font color="#6b3fa0">purple</font>')).toBe('<span class="c-purple">purple</span>');
    expect(sanitizeRichHtml('<span style="color: rgb(226, 74, 46)">orange</span>')).toBe('<span class="c-orange">orange</span>');
  });

  it("keeps an existing brand class, drops foreign classes and colors", () => {
    expect(sanitizeRichHtml('<span class="c-teal">t</span>')).toBe('<span class="c-teal">t</span>');
    expect(sanitizeRichHtml('<span class="hack">t</span>')).toBe("<span>t</span>");
    expect(sanitizeRichHtml('<span style="color: #123456">t</span>')).toBe("<span>t</span>");
  });

  it("drops unknown tags but keeps their text", () => {
    expect(sanitizeRichHtml("<article><p>kept</p></article>")).toBe("<p>kept</p>");
  });

  it("escapes stray angle brackets and balances unclosed tags", () => {
    expect(sanitizeRichHtml("<p>1 < 2</p>")).toBe("<p>1 &lt; 2</p>");
    expect(sanitizeRichHtml("<p><strong>never closed")).toBe("<p><strong>never closed</strong></p>");
  });

  it("links become plain spans (no href survives)", () => {
    expect(sanitizeRichHtml('<a href="https://evil.example">text</a>')).toBe("<span>text</span>");
  });
});

describe("sanitizePlainText", () => {
  it("strips all markup and trims", () => {
    expect(sanitizePlainText("  <b>hi</b> there ")).toBe("hi there");
  });
});
