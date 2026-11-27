# txt: UI/UX Design Plan, v3 (grainy desk, stickers, pencil sketches)

> Concept stays "a reading desk". The desk is now a grainy paper surface with a few scattered scrapbook stickers and pencil sketches. The sheet in the centre stays clean. One saffron spot colour adds contrast in a few tiny places.

## 2. Design principles (REPLACE #6 and #7)

6. **A lived-in desk, a clean sheet.** Stickers and pencil sketches live on the desk, in the side gutters only. The sheet carries no illustrations (only the paperclip).
7. **One spark of colour.** The desk is muted (sage, cream, kraft, graphite). Saffron appears in at most 4 tiny places per viewport, so it reads as a deliberate highlight.

## 3. Design tokens (REPLACE the v2 art tokens)

```css
:root {
  --spot:       #F0A92E;   /* saffron highlighter: decoration only, never a signal */
  --graphite:   #3A3733;   /* pencil sketch tone (used for reference, sketches are images) */
  --clip:       #2A2723;
  --clip-shadow: rgba(40,30,15,.28);
  --sheet-half: calc(min(var(--sheet-w), 100vw - 48px) / 2);   /* used to place desk items */
}
```
- Keep `--marker` (lemon, evidence highlights in text) and `--spot` (saffron-orange, art and accents) visibly different. Never use signal reds, greens or ambers for decoration.
- Apply `--spot` with `mix-blend-mode: multiply` so it looks like a highlighter on paper.

## 5. Paper look (REPLACE the `body` rule, EXTEND `.sheet`)

Grainy desk: a soft light, a vignette, fine grain and long paper fibres. All are CSS backgrounds, so there are no image requests.

```css
body {
  background-color: var(--desk);
  background-image:
    radial-gradient(ellipse at 50% 25%, rgba(255,250,235,.55), transparent 62%),   /* soft lamp light */
    radial-gradient(ellipse at 50% 110%, rgba(90,70,40,.22), transparent 70%),     /* edge vignette */
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.015 .45' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .1 0'/></filter><rect width='100%' height='100%' filter='url(%23f)'/></svg>"),   /* paper fibres */
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25  0 0 0 0 .18  0 0 0 0 .1  0 0 0 .24 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>");   /* fine grain */
  background-size: auto, auto, 420px 420px, 220px 220px;
  background-attachment: fixed, fixed, scroll, scroll;
}
/* sheet grain: same recipe, a little lighter (raise the existing .07 alpha to .10) */
```
If the grain looks too strong or too faint, only the last number in each `feColorMatrix` (`.24` and `.1`) needs changing.

## 5b. Desk layer: stickers and pencil sketches (NEW, replaces the v2 illustration set)

**Two asset types, both transparent WebP images (no hand-coded SVG drawings)**

| Type | Look | Count (≥1280px) | Size |
|---|---|---|---|
| Stickers | Muted sage, cream and kraft scrapbook pieces: note cards, a framed botanical, tags, a butterfly, a button, a pressed flower | 7 | 2 large (170-210px), 3 medium (110-140px), 2 small (56-80px) |
| Pencil sketches | Graphite, scratchy hatching, uneven line weight, no fills: a leafy sprig, a wildflower, a leaf whose veins become circuit traces | 2-3 | 150-240px |

**Placement rules**
1. Desk items sit in the left and right gutters of the sheet, fixed to the viewport (the sheet scrolls over the desk). Maximum 7 stickers and 3 sketches at 1280px and above.
2. Vary sizes and rotation (-9deg to +9deg). Alternate left and right, and never put two large items at the same height.
3. A sticker may tuck under the sheet edge by up to 30% of its width. A sketch may tuck by up to 40%. Nothing crosses onto sheet content.
4. Responsive: ≥1280px full set. 1024-1279px medium and small items only. Below 1024px no desk items (the gutters are too narrow). The paperclip and the grain remain.
5. Stickers get a static soft shadow (`drop-shadow(0 2px 3px rgba(60,45,20,.22))`). Sketches use `mix-blend-mode: multiply` at `opacity: .8`, so they look drawn on the desk, not pasted.
6. All desk items are decoration: `alt=""`, `aria-hidden`, `pointer-events: none`.
7. The stickers are green. Green is also the "human" signal on the result stamp. The stamp always carries its text label, and the stickers stay in the gutters, so they can't be mistaken for a verdict.

**Where the assets come from**
- Use the inspiration sticker sheet as a **style reference only**. Do not ship it, because you may not hold the rights.
- Generate your own sticker sheet and sketch set with an image generator, or use free CC0 and public-domain sources (Pixabay, Openverse with the CC0 filter, Rawpixel public domain, Biodiversity Heritage Library botanical plates).
- Sticker sheet prompt: *"Scrapbook sticker sheet, muted sage green and cream and kraft, torn paper note cards, a framed pressed-flower card, tags, a butterfly, a button, a small leaf sprig, soft paper texture, pure white background, wide gaps between pieces, no text"*.
- Pencil sketch prompt: *"Graphite pencil sketch of [a leafy sprig / a five-petal wildflower / a leaf whose veins turn into circuit traces], loose scratchy hatching, visible pencil grain, uneven line weight, no fill, isolated on pure white background, lots of empty space, no text"*.
- Cut them out and save as transparent WebP (see the frontend plan for the slicing script). Pencil sketches on pure white also work as they are, because `mix-blend-mode: multiply` makes the white disappear.
- Budget: each file ≤ 30 KB, all desk art together ≤ 250 KB.

## 5c. Spot colour: exactly where it appears (NEW)

| # | Place | Look |
|---|---|---|
| 1 | Hero key word *lines.* | A saffron highlighter swipe behind the lower half of the word, slightly slanted, ragged ends |
| 2 | Active tab | The sliding underline becomes a 5px saffron swipe |
| 3 | Washi tape on a sketch | A small saffron tape strip (84 x 24px, zigzag ends, rotated) holding the top corner of one sketch on the desk |
| 4 | A second tape (optional) | Only if the viewport shows fewer than 4 spots |

Rules: at most 4 spot areas in a viewport. Never behind body text other than the hero key word. Never inside the result sheet (the stamp is the accent there).

## 5d. Paperclip (REPLACE the v2 paperclip spec)

- A steel-black gem clip, 34 x 86px on desktop and 26 x 66px on mobile, on the top-right corner of the main input sheet (top-left on `/method`).
- Overlaps the sheet by about 60%. The top loop pokes about 18px above the edge. Rotated 6deg.
- Static soft shadow only. Not shown on the result sheet.
- This is the only object on the sheet. No other drawings on the sheet: no underline, no empty-state art, no margin arrows (use a plain "→" in Caveat).

## 7. Components (REPLACE the v2 rows)

| Component | Look |
|---|---|
| Paperclip | 2.2px steel-black wire, round caps, tiny shadow, on the sheet's top corner |
| Hero key word | Italic Fraunces with a saffron highlighter swipe behind it |
| Tabs | Mono uppercase labels, saffron 5px swipe slides under the active tab |
| Desk sticker | Die-cut sticker with a static soft shadow, slightly rotated |
| Desk sketch | Graphite pencil drawing, multiplied onto the desk, sometimes held by saffron tape |
| Method dividers | The existing `.rule-draw` ink rule (no squiggle drawings) |

## 8. Motion (REPLACE the v2 art rows)

| Moment | Animation | Duration / ease |
|---|---|---|
| Page load, paperclip | Slides down onto the corner after the sheet lands | 0.5s / `power3.out` |
| Page load, hero swipe | Saffron swipe wipes in left to right behind the word | 0.5s / `power2.out` |
| Page load, desk | Stickers and sketches "stick on": opacity 0 to 1, scale 1.12 to 1, small drop of 10px, staggered | 0.45s each, stagger .09, starts 0.5s in, never blocks input |
| Idle | Nothing. No floating, no parallax, no wiggling | |

Reduced motion: everything shown in its final position, no movement. Allowed animated properties stay `transform`, `opacity` and `background-size`.

## 12. Do and don't (REPLACE the v2 art lines)

Do: keep the desk muted and sparse, vary sticker sizes and angles, keep the sheet clean, keep saffron tiny and visible.
Don't: put art on the sheet (except the clip), overlap text, use more than 7 stickers and 3 sketches, use saffron for anything that carries meaning, use signal colours for decoration, animate the art after the intro, ship assets you do not have rights to.

## 13. Design QA checklist (REPLACE the v2 art lines)

- [ ] Desk has visible grain and soft vignette at 1280px, and sheet grain is visible but never hurts reading
- [ ] Stickers vary in size and rotation, are not clustered, and none overlap sheet content
- [ ] At most 7 stickers, 3 sketches and 4 saffron areas in any viewport
- [ ] Saffron swipe behind *lines.* is clearly visible in a screenshot
- [ ] 1024-1279px shows only medium and small items. Below 1024px no desk items
- [ ] Paperclip sits cleanly on the corner at 360px, 768px and 1280px
- [ ] All desk art is `aria-hidden` and not focusable
- [ ] Reduced motion shows the final state with no movement
- [ ] Print view has no desk, no stickers, no clip
- [ ] Every shipped image has a documented source or licence