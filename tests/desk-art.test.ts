import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeskLayer } from "@/frontend/components/art/DeskLayer";
import { PaperClip } from "@/frontend/components/art/PaperClip";
import { DESK_ITEMS } from "@/frontend/lib/desk-items";

function render(element: React.ReactElement) {
  return renderToStaticMarkup(element);
}

describe("desk art components", () => {
  it("renders the desk layer hidden from assistive tech", () => {
    const html = render(createElement(DeskLayer));

    expect(html).toContain('class="desk-layer"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders one decorative image per desk item", () => {
    const html = render(createElement(DeskLayer));

    const altCount = html.match(/alt=""/g)?.length ?? 0;
    expect(altCount).toBe(DESK_ITEMS.length);
    expect(html).not.toMatch(/alt="[^"]+"/);
  });

  it("renders every item with its tier and side", () => {
    const html = render(createElement(DeskLayer));

    for (const item of DESK_ITEMS) {
      expect(html).toContain(`data-kind="${item.kind}"`);
      expect(html).toContain(`data-side="${item.side}"`);
      expect(html).toContain(`data-tier="${item.tier}"`);
    }
  });

  it("renders the paperclip at a fixed 34 x 86", () => {
    const html = render(createElement(PaperClip));

    expect(html).toContain('width="34"');
    expect(html).toContain('height="86"');
    expect(html).toContain('class="clip"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
  });

  it("places the clip on the requested corner", () => {
    expect(render(createElement(PaperClip, { corner: "tl" }))).toContain(
      'data-corner="tl"',
    );
    expect(render(createElement(PaperClip))).toContain('data-corner="tr"');
  });
});
