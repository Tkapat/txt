# txt: Frontend Plan, v3 (desk layer with image assets)

> Replaces the v2 inline-SVG art. The desk is a fixed layer of transparent WebP stickers and sketches. The only SVG left is the paperclip. Rules still hold: thin routes, no fetch in components, GSAP only in `animations/`.

## 0. Remove from v2
Delete `Sprig.tsx`, `Flower.tsx`, `CircuitLeaf.tsx`, `PenUnderline.tsx`, `Squiggle.tsx`, `DeskArt.tsx`, `animations/ink.ts`, and every `.pen`, `.art-*` and `.pen-underline` rule in `art.css`. Remove the `CircuitLeaf` from `EmptyState` and the `Squiggle` from `Marginalia`.

## 3. Folder structure (REPLACE the v2 art block)

```
public/
├── stickers/    sticker-01.webp ... sticker-07.webp     # transparent, ≤ 480px, ≤ 30 KB each
└── sketches/    leaves.webp  flower.webp  circuit-leaf.webp
scripts/
└── slice_stickers.py                                    # cuts a sticker sheet into transparent files
src/frontend/
├── components/art/
│   ├── PaperClip.tsx            # the only SVG, fixed size
│   └── DeskLayer.tsx            # renders the scattered items (Server Component)
├── lib/desk-items.ts            # the scatter config: size, side, position, rotation
├── animations/desk.ts           # stickOn(), dropClip(), wipeSwipe()
└── styles/art.css               # desk layer, paperclip, hero swipe, tape, print
```

## 5. Asset pipeline

Quick path: a sticker or sketch on a pure white background can be used as it is with `mix-blend-mode: multiply` (the white disappears). Colours darken a little.

Proper path: cut each piece out to a transparent WebP with the script below. It is a starting point, so open the output folder and delete any junk pieces.

```bash
pip install opencv-python pillow numpy
python scripts/slice_stickers.py my-sticker-sheet.png public/stickers
```

```python
# scripts/slice_stickers.py
import sys, pathlib, cv2, numpy as np
from PIL import Image

src, out = sys.argv[1], pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
img = cv2.imread(src, cv2.IMREAD_COLOR)
fg = (img.min(axis=2) < 244).astype(np.uint8) * 255                      # anything not near-white
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))    # bridge small gaps
n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
k = 0
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < 2500: continue                                             # ignore specks
    mask = (labels[y:y+h, x:x+w] == i).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask); cv2.drawContours(filled, cnts, -1, 255, -1)   # fill holes inside the piece
    filled = cv2.GaussianBlur(filled, (3, 3), 0)                                # soften the edge
    rgba = cv2.cvtColor(img[y:y+h, x:x+w], cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = filled
    im = Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA)); im.thumbnail((480, 480))
    k += 1; im.save(out / f"sticker-{k:02d}.webp", quality=82, method=6)
print(k, "pieces written")
```
Rule: only ship assets you own, generated yourself, or with a licence that allows it. Note the source in `public/stickers/SOURCES.md`.

## 6b. Scatter config

```ts
// src/frontend/lib/desk-items.ts
export type DeskItem = {
  id: string; src: string; kind: "sticker" | "sketch";
  w: number; h: number;      // display size in px at ≥1280 (match the file's aspect ratio)
  side: "l" | "r";           // which gutter
  top: number;               // vh from the top of the viewport
  tuck: number;              // px tucked under the sheet (≤ 30% of w for stickers, ≤ 40% for sketches)
  rot: number;               // degrees
  tier: "m" | "l";           // m: shows ≥1024px, l: shows ≥1280px only
  tape?: boolean;            // saffron tape on the top corner
};

// Roles shown below; rename the src files to match your cut-outs. Sizes are examples, adjust to each image.
export const DESK_ITEMS: DeskItem[] = [
  { id: "note-card",    src: "/stickers/sticker-01.webp", kind: "sticker", w: 190, h: 200, side: "l", top: 6,  tuck: 40, rot: -6, tier: "l" },
  { id: "framed-botan", src: "/stickers/sticker-02.webp", kind: "sticker", w: 170, h: 220, side: "r", top: 10, tuck: 36, rot: 5,  tier: "l" },
  { id: "butterfly",    src: "/stickers/sticker-03.webp", kind: "sticker", w: 120, h: 100, side: "l", top: 42, tuck: 20, rot: 8,  tier: "m" },
  { id: "tag",          src: "/stickers/sticker-04.webp", kind: "sticker", w: 110, h: 150, side: "r", top: 48, tuck: 24, rot: -8, tier: "m" },
  { id: "pressed-leaf", src: "/stickers/sticker-05.webp", kind: "sticker", w: 130, h: 100, side: "l", top: 72, tuck: 30, rot: 4,  tier: "l" },
  { id: "button",       src: "/stickers/sticker-06.webp", kind: "sticker", w: 64,  h: 64,  side: "r", top: 74, tuck: 8,  rot: 0,  tier: "m" },
  { id: "tiny-flower",  src: "/stickers/sticker-07.webp", kind: "sticker", w: 72,  h: 72,  side: "r", top: 28, tuck: 10, rot: 12, tier: "l" },
  { id: "sketch-leaves", src: "/sketches/leaves.webp",     kind: "sketch",  w: 230, h: 260, side: "l", top: 22, tuck: 60, rot: -9, tier: "m", tape: true },
  { id: "sketch-flower", src: "/sketches/flower.webp",     kind: "sketch",  w: 190, h: 240, side: "r", top: 60, tuck: 50, rot: 6,  tier: "l" },
  { id: "sketch-circuit", src: "/sketches/circuit-leaf.webp", kind: "sketch", w: 150, h: 150, side: "l", top: 84, tuck: 30, rot: -4, tier: "l", tape: true },
];
```
Spread the `top` values and sizes by eye after the first render. The goal is varied, not symmetrical.

## 6c. Components

```tsx
// src/frontend/components/art/DeskLayer.tsx  (Server Component)
import Image from "next/image";
import { DESK_ITEMS } from "@/frontend/lib/desk-items";

export function DeskLayer() {
  return (
    <div className="desk-layer" aria-hidden="true">
      {DESK_ITEMS.map((it) => (
        <div
          key={it.id}
          className="desk-item"
          data-kind={it.kind} data-side={it.side} data-tier={it.tier} data-tape={it.tape ? "true" : undefined}
          style={{ ["--w" as string]: it.w, ["--top" as string]: it.top, ["--tuck" as string]: it.tuck, ["--rot" as string]: it.rot }}
        >
          <Image src={it.src} alt="" width={it.w} height={it.h} loading="lazy" draggable={false} />
        </div>
      ))}
    </div>
  );
}
```
```tsx
// src/frontend/components/art/PaperClip.tsx  (fixed size: cannot blow up if CSS fails)
export function PaperClip({ corner = "tr" }: { corner?: "tr" | "tl" }) {
  return (
    <svg className="clip" data-corner={corner} width="34" height="86" viewBox="0 0 34 86" fill="none" aria-hidden="true" focusable="false">
      <path d="M13 58 V20 a8 8 0 0 1 16 0 V66 a12 12 0 0 1 -24 0 V30 a8 8 0 0 1 16 0 V62"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```
Hero key word (typography on the sheet, not an illustration):
```tsx
<em className="hero-key">lines.<span className="swipe" aria-hidden="true" /></em>
```

## 5b. Styles: `art.css` (REPLACE the whole file)

```css
/* desk layer: fixed to the viewport, the sheet scrolls over it */
.desk-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.desk-item  { position: absolute; top: calc(var(--top) * 1vh); width: calc(var(--w) * 1px); rotate: calc(var(--rot) * 1deg); display: none; }
.desk-item img { width: 100%; height: auto; display: block; user-select: none; }
.desk-item[data-side="l"] { left: calc(50% - var(--sheet-half) - var(--w) * 1px + var(--tuck) * 1px); }
.desk-item[data-side="r"] { left: calc(50% + var(--sheet-half) - var(--tuck) * 1px); }
.desk-item[data-kind="sticker"] img { filter: drop-shadow(0 2px 3px rgba(60,45,20,.22)); }
.desk-item[data-kind="sketch"]  img { mix-blend-mode: multiply; opacity: .8; }

/* saffron washi tape on a sketch corner */
.desk-item[data-tape="true"]::after {
  content: ""; position: absolute; top: -10px; left: 50%; width: 84px; height: 24px; margin-left: -42px; rotate: -16deg;
  background: var(--spot); opacity: .88; mix-blend-mode: multiply;
  clip-path: polygon(0 0,100% 0,98% 20%,100% 40%,98% 60%,100% 80%,98% 100%,0 100%,2% 80%,0 60%,2% 40%,0 20%);
}

/* the sheet sits above the desk */
.sheet { z-index: 1; }
.page-shell { position: relative; }          /* PageShell root */

/* tiers: only show what fits the gutters */
@media (min-width: 1024px) { .desk-item[data-tier="m"] { display: block; } }
@media (min-width: 1280px) { .desk-item[data-tier="l"] { display: block; } }

/* paperclip */
.clip { position: absolute; top: -18px; width: 34px; height: 86px; z-index: 2; pointer-events: none;
        color: var(--clip); filter: drop-shadow(0 1px 1px var(--clip-shadow)); }
.clip[data-corner="tr"] { right: 48px; rotate: 6deg; }
.clip[data-corner="tl"] { left: 48px;  rotate: -6deg; }
@media (max-width: 767px) { .clip { width: 26px; height: 66px; right: 24px; } }

/* hero highlighter swipe */
.hero-key { position: relative; display: inline-block; z-index: 0; }
.swipe { position: absolute; z-index: -1; left: -.06em; right: -.1em; bottom: .08em; height: .45em;
         background: var(--spot); mix-blend-mode: multiply; opacity: .9; transform-origin: left center;
         clip-path: polygon(0 22%, 100% 0, 97% 86%, 3% 100%); }

/* active tab swipe (the sliding underline element) */
.tab-underline { height: 5px; background: var(--spot); mix-blend-mode: multiply;
                 clip-path: polygon(0 30%, 100% 0, 100% 80%, 0 100%); }

@media print { .desk-layer, .clip, .swipe, .tab-underline { display: none !important; } }
```
Import `art.css` in `globals.css` after `paper.css`, and make sure `PageShell`'s root has the `page-shell` class. If the desk layer ever looks wrong, check these two first: the CSS import and `position: relative` on the shell.

## 6d. Wiring

- `PageShell` renders `<DeskLayer />` once, before `{children}`. It takes no props.
- `PaperSheet` keeps the `clip?: "tr" | "tl" | false` prop. Input sheet on `/` and `/reviews` uses `clip="tr"`, `/method` uses `clip="tl"`. The result sheet never gets a clip.
- Wrap the hero key word as shown above.
- `ModeTabs` uses the `.tab-underline` element for the sliding underline.
- Nothing else is drawn on the sheet: no art in `EmptyState`, no art in `Marginalia` (use a Caveat "→").

## 8b. Animation: `desk.ts` (REPLACE `ink.ts`)

```ts
// src/frontend/animations/desk.ts
import gsap from "gsap";

export function stickOn(scope: HTMLElement) {
  const items = scope.querySelectorAll(".desk-item");
  return gsap.from(items, { opacity: 0, scale: 1.12, y: -10, duration: 0.45, ease: "power2.out", stagger: 0.09 });
}
export function dropClip(clip: SVGElement) {
  return gsap.from(clip, { y: -24, opacity: 0, duration: 0.5, ease: "power3.out" });
}
export function wipeSwipe(swipe: HTMLElement) {
  return gsap.from(swipe, { scaleX: 0, duration: 0.5, ease: "power2.out" });
}
```
Hook into the end of `playIntro(scope)`:
```ts
const clip  = scope.querySelector<SVGElement>(".clip");
const swipe = scope.querySelector<HTMLElement>(".swipe");
if (clip)  tl.add(dropClip(clip), "-=0.3");          // after the sheet lands
if (swipe) tl.add(wipeSwipe(swipe), "-=0.1");        // after the hero text
gsap.delayedCall(0.5, () => stickOn(document.querySelector(".desk-layer") as HTMLElement));   // background, never blocks input
```
The individual CSS `rotate` property is used for rotation, so GSAP's `scale` and `y` do not overwrite it. Reduced motion: do nothing, everything is already in its final state.

## 2. Principles (REPLACE the v2 #7)

7. **Art is decoration only.** Desk items are images with `alt=""`, never interactive, never carrying meaning, and never placed on the sheet (except the paperclip).

## 8. Accessibility and responsive rules (REPLACE the v2 art lines)

- Desk art is `aria-hidden`, has `pointer-events: none`, and never receives focus.
- Breakpoints: ≥1280px full set, 1024-1279px medium and small items only, below 1024px no desk items. The paperclip stays at all sizes.
- Saffron never sits under body text, except the hero key word swipe. Keep text contrast on the swipe at 4.5:1 or better (`--ink` on saffron passes).
- Print hides the desk layer, clip and swipes.

## 9. Performance (REPLACE the v2 art lines)

- Desk images are lazy-loaded WebP with fixed `width` and `height`, so there is no layout shift. Budget ≤ 250 KB total, ≤ 30 KB each.
- `DeskLayer` is a Server Component, so it adds no client JS. Only the GSAP intro call runs on the client.
- Shadows are static and only on a few images. `mix-blend-mode` is used on the sketches, tape and swipe only.

## 10. Testing (REPLACE the v2 art lines)

- Component: `DeskLayer` renders every item with `aria-hidden="true"` on the wrapper and `alt=""` on every image. `PaperClip` renders at fixed 34 x 86.
- Config: a unit test checks every `DeskItem` has `tuck` ≤ 30% of `w` (stickers) or ≤ 40% of `w` (sketches), and that no more than 7 stickers and 3 sketches are defined.
- Visual: screenshots at 360, 1024 and 1280px. Confirm no overlap with sheet content, visible grain, visible saffron swipe, at most 4 saffron areas.
- Manual: keyboard pass shows no focus stops in art. Reduced motion shows final state. Print preview shows no art.

## 11. Task checklist for agents (REPLACE the v2 art lines)

- [ ] Add `--spot`, `--clip` and `--sheet-half` tokens, replace the `body` background with the grain version
- [ ] Generate or source the sticker sheet and sketches, cut with `slice_stickers.py`, save to `public/`
- [ ] Write `desk-items.ts` and tune sizes, sides and positions by eye
- [ ] Build `DeskLayer` and `PaperClip`, add `art.css`, wire into `PageShell` and `PaperSheet`
- [ ] Hero swipe and the saffron tab underline
- [ ] `animations/desk.ts` hooked into `playIntro` with reduced-motion fallback
- [ ] Delete the v2 SVG art components and CSS
- [ ] Check responsive tiers, print hiding, and the 7 / 3 / 4 limits