# txt: UI/UX Design Plan

> Audience: Team C, designers and AI coding agents.
> Concept: **a reading desk.** The product is about text, so the interface feels like paper, ink, a stamp and handwritten margin notes. Calm, precise, a little literary.

## 1. Brand

- **Name:** `txt` (always lowercase, set in the display serif, optionally with a blinking underscore cursor `txt_` in the masthead).
- **Tagline:** "Read between the lines."
- **Voice:** calm, exact, never accusing. Say "reads as likely AI-written", "evidence", "estimate", never "fake" or "caught".
- **Feel:** premium stationery, a researcher's notebook, an editor's desk.

## 2. Design principles

1. **Paper first.** Content sits on sheets of warm paper over a slightly darker desk.
2. **Ink hierarchy.** Black ink for content, soft grey ink for secondary text, red ink only for AI signals, green ink for human signals, blue pen for handwritten notes.
3. **Evidence over drama.** Show why (highlights, phrases, cues). Motion supports understanding and is never decoration only.
4. **Quiet by default.** One accent animation per moment. No bouncing, no neon.
5. **Honest uncertainty.** Ranges, "uncertain" is a first-class result, and the limits are visible.

## 3. Design tokens

```css
/* src/frontend/styles/tokens.css */
:root {
  /* surfaces */
  --desk:        #E8E0CF;
  --paper:       #F6F1E6;
  --paper-edge:  #EAE2D0;
  /* ink */
  --ink:         #1C1A17;   /* body text (high contrast) */
  --ink-soft:    #4F4A43;   /* secondary text, still AA on paper */
  --ink-faint:   #8A8377;   /* decoration only, never body text */
  --rule:        #D9D0BD;   /* lines, borders */
  /* signal inks */
  --stamp-red:   #9B2D26;   /* AI */
  --stamp-green: #2F5D50;   /* human */
  --stamp-amber: #8A6A1F;   /* uncertain */
  --marker:      #F2D45C;   /* highlighter */
  --pen-blue:    #2B4A7A;   /* handwritten marginalia */
  /* type */
  --font-display: var(--font-fraunces), "Iowan Old Style", Georgia, serif;
  --font-text:    var(--font-newsreader), Georgia, serif;
  --font-mono:    var(--font-plex-mono), ui-monospace, monospace;
  --font-hand:    var(--font-caveat), "Segoe Script", cursive;
  /* scale (fluid) */
  --fs-hero:  clamp(2.6rem, 2rem + 3vw, 4.6rem);
  --fs-h2:    clamp(1.6rem, 1.3rem + 1.2vw, 2.3rem);
  --fs-body:  clamp(1.05rem, 1rem + 0.2vw, 1.2rem);
  --fs-small: 0.875rem;
  --fs-label: 0.75rem;
  /* space and shape: 8px base */
  --s1: 4px; --s2: 8px; --s3: 16px; --s4: 24px; --s5: 40px; --s6: 64px;
  --radius: 2px;                       /* paper has almost square corners */
  --sheet-w: 880px;
  --shadow-sheet: 0 1px 0 rgba(0,0,0,.04), 0 14px 28px -14px rgba(60,45,20,.28), 0 3px 8px rgba(60,45,20,.10);
}
```
Contrast: `--ink` and `--ink-soft` on `--paper` pass AA for body text. `--ink-faint` fails for small text, so use it for ornaments only.

## 4. Fonts (Google Fonts via `next/font`)

| Role | Font | Why | Where |
|---|---|---|---|
| Display | **Fraunces** (variable, soft serif) | Warm, classic with a modern edge, premium feel | Wordmark, hero, stamps, big numbers |
| Reading text | **Newsreader** | Built for long reading, calm and literary | Inputs, highlighted text, paragraphs |
| Labels and data | **IBM Plex Mono** | Typewriter and lab-notebook character | Tabs, buttons, small labels, metrics |
| Handwriting | **Caveat** | Margin notes feel hand-written | Marginalia only (short notes) |

```ts
// src/app/fonts.ts
import { Fraunces, Newsreader, IBM_Plex_Mono, Caveat } from "next/font/google";
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"], display: "swap" });
export const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"], display: "swap" });
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });
export const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
```
```tsx
// src/app/layout.tsx
<html lang="en" className={`${fraunces.variable} ${newsreader.variable} ${plexMono.variable} ${caveat.variable}`}>
```
Docs: https://nextjs.org/docs/app/api-reference/components/font. If a font option is rejected for your installed version, drop the `axes` option and keep defaults.

Type rules: hero in Fraunces light italic for the key word; labels in Plex Mono uppercase with 0.08em letter-spacing; body 1.05-1.2rem with line-height 1.7; max line length 68ch.

## 5. Paper look (CSS only)

```css
/* src/frontend/styles/paper.css */
body { background: var(--desk); color: var(--ink); font-family: var(--font-text); font-size: var(--fs-body); line-height: 1.7; }

.sheet {
  position: relative; max-width: var(--sheet-w); margin-inline: auto; padding: var(--s5);
  background-color: var(--paper); border-radius: var(--radius); box-shadow: var(--shadow-sheet);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .2  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.sheet::before {                       /* a second sheet peeking out underneath */
  content: ""; position: absolute; inset: 6px -6px -6px 6px; z-index: -1;
  background: var(--paper-edge); border-radius: var(--radius); transform: rotate(.6deg); box-shadow: var(--shadow-sheet);
}

.ruled {                               /* ruled notebook lines for the textarea */
  line-height: 32px; background-image: repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule) 31px 32px);
  background-attachment: local; border: 0; outline: none; resize: vertical; padding: 0 var(--s2);
}
.ruled:focus-visible { box-shadow: 0 0 0 2px var(--pen-blue); }

.hl {                                  /* highlighter marker: animated by GSAP via background-size */
  background: linear-gradient(transparent 55%, var(--marker) 55% 92%, transparent 92%) no-repeat;
  background-size: 100% 100%; text-decoration: none; padding-inline: 1px; border-radius: 1px; cursor: help;
}
.hl[data-active="true"] { background-image: linear-gradient(transparent 40%, var(--marker) 40% 95%, transparent 95%); outline: 1px dashed var(--ink-faint); }

.stamp {                               /* rubber stamp */
  display: inline-block; padding: .35em .9em; font: 500 var(--fs-small)/1 var(--font-mono); letter-spacing: .14em; text-transform: uppercase;
  border: 3px double currentColor; border-radius: 4px; transform: rotate(-4deg); mix-blend-mode: multiply; filter: url(#rough); opacity: .92;
}
.stamp[data-verdict="likely_ai"] { color: var(--stamp-red); }
.stamp[data-verdict="likely_human"] { color: var(--stamp-green); }
.stamp[data-verdict="uncertain"] { color: var(--stamp-amber); }

.marginalia { font-family: var(--font-hand); color: var(--pen-blue); font-size: 1.25rem; line-height: 1.2; transform: rotate(-1.2deg); }
.rule-draw { height: 1px; background: var(--ink); transform-origin: left; }
```
Put the rough-edge filter once in `layout.tsx`:
```html
<svg width="0" height="0" aria-hidden="true"><filter id="rough"><feTurbulence baseFrequency="0.04" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2"/></filter></svg>
```

## 6. Page layouts

**Workbench `/`**
```
┌ desk ─────────────────────────────────────────────────────────────┐
│  txt_                                   Detector   Reviews   Method│
│                                                                    │
│  ┌ sheet ──────────────────────────────────────────────────────┐   │
│  │  Read between the *lines.*                  (hero, Fraunces)│   │
│  │  ───────────────────────── (rule draws in)                   │   │
│  │  [ Text ] [ File ]                          (mono tabs)      │   │
│  │  ┌ ruled paste area ──────────────────────────┐              │   │
│  │  │ Paste text here...                         │ 124 words    │   │
│  │  └────────────────────────────────────────────┘ [ Try a sample ▾ ]│
│  │                                   [ Analyse  ⌘↵ ]            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌ result sheet (after analysis) ──────────────────────────────┐   │
│  │ [ STAMP: LIKELY AI-WRITTEN ]  72%  ├──────────●──┤  medium    │   │
│  │ text with highlighted phrases   │  margin notes (handwritten)│   │
│  │                                 │  1. "…phrase…"   2. …  3. …│   │
│  │ Disclaimer: probability, not proof.                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

**Reviews `/reviews`**
```
 sheet: paste reviews or upload CSV         [ Analyse reviews ]
 result sheet:
   "About 32%"  (range 24-41%)    ← big Fraunces number, counts up
   37 of 112 analysed reviews flagged · 8 skipped (too short)
   ── Evidence ──  3 quoted phrases, each with "Review #14" in handwriting
   ── Pattern ──   "9 reviews share the same sentence structure (experimental)"
   ── All reviews ── table (probability mini-rule, verdict word, expand row)
```

**Method `/method`:** a long single sheet with numbered sections that unfold on scroll: What it measures, How it works, How accurate it is (our unseen-generator results), What it cannot do, Privacy.

## 7. Components: visual rules

| Component | Look |
|---|---|
| Buttons | Primary: ink-black fill, paper-coloured Plex Mono text, 2px radius, hover lifts 1px with a soft shadow. Secondary: underlined text. Focus ring: 2px `--pen-blue`. |
| Tabs | Mono uppercase labels with a hand-drawn underline that slides to the active tab. |
| Probability rule | 1px ink line with tick marks (like a ruler), the marker is a small ink triangle, threshold ticks labelled in mono. |
| Evidence list | Numbered like footnotes. Phrase in italic Newsreader, weight shown as a thin bar. |
| Cues | Handwritten margin notes with a small arrow pointing to the text. |
| Prevalence number | Fraunces, huge, tabular figures. Range shown beneath in mono. |
| Loader | An ink line writing itself across the page (SVG path), plus the text "Reading…". |
| Error | A torn-corner note in amber ink with the message and a "Try again" link. |

## 8. Motion with GSAP

Install: `npm i gsap @gsap/react`. Docs: https://gsap.com/docs/v3/ and https://gsap.com/resources/React/. GSAP and its plugins are free to use (confirm on gsap.com before shipping). Keep all GSAP code in `src/frontend/animations/` and run it from client components with `useGSAP`.

| Moment | Animation | Duration / ease |
|---|---|---|
| Page load | Sheet slides up (40px) with a slight rotation, wordmark letters rise one by one, hero rule draws in left to right, text fades up in sequence | 0.9s / `power3.out`, stagger .06-.08 |
| Typing | Word counter ticks; the Analyse button underlines | instant |
| Analysing | Ink loader line draws and repeats | 1.2s linear, repeat |
| Result arrives | Stamp **thumps** onto the sheet (scale 1.8 → 1, rotate -12 → -4), sheet gives a 2px bounce | 0.35s / `power4.in`, then 0.25s |
| Probability | Marker slides from 0 to the value, number counts up | 1.1s / `power3.out` |
| Evidence | Highlights sweep in one after another (marker draws across), then margin notes fade in | 0.7s each, stagger .25 |
| Hover phrase / highlight | Linked highlight pulses (background-size flick), the other fades to 60% | 0.2s |
| File drag over | Sheet tilts 1deg and the dashed border draws | 0.25s |
| Reviews figure | Percentage counts up, range fades in after | 1.2s |
| Method page | Sections unfold (clip + translate) as they scroll into view | ScrollTrigger, 0.8s |

```ts
// src/frontend/animations/intro.ts
import gsap from "gsap";
export function playIntro(scope: HTMLElement) {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.from(scope.querySelector(".sheet"), { y: 40, rotate: 0.8, opacity: 0, duration: 0.9 })
    .from(scope.querySelectorAll(".masthead-char"), { yPercent: 110, opacity: 0, stagger: 0.06, duration: 0.7 }, "-=0.5")
    .from(scope.querySelectorAll(".rule-draw"), { scaleX: 0, duration: 0.8 }, "-=0.4")
    .from(scope.querySelectorAll(".fade-up"), { y: 16, opacity: 0, stagger: 0.08, duration: 0.6 }, "-=0.5");
  return tl;
}
// stamp.ts
export function thumpStamp(stamp: HTMLElement, sheet: HTMLElement) {
  return gsap.timeline()
    .fromTo(stamp, { scale: 1.8, rotate: -12, opacity: 0 }, { scale: 1, rotate: -4, opacity: 0.92, duration: 0.35, ease: "power4.in" })
    .to(sheet, { y: 2, duration: 0.06, yoyo: true, repeat: 1, ease: "power1.inOut" }, "<0.3");
}
// highlights.ts
export function sweepHighlights(root: HTMLElement) {
  const marks = root.querySelectorAll<HTMLElement>(".hl");
  return gsap.fromTo(marks, { backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%", duration: 0.7, stagger: 0.25, ease: "power2.inOut" });
}
// counter.ts
export function countUp(el: HTMLElement, to: number, suffix = "%") {
  const o = { v: 0 };
  return gsap.to(o, { v: to, duration: 1.2, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } });
}
// scrollReveal.ts
import { ScrollTrigger } from "gsap/ScrollTrigger"; gsap.registerPlugin(ScrollTrigger);
export function revealOnScroll(items: Element[]) {
  items.forEach((el) => gsap.from(el, { opacity: 0, y: 24, clipPath: "inset(0 0 100% 0)", duration: 0.8, ease: "power2.out",
    scrollTrigger: { trigger: el, start: "top 85%", once: true } }));
}
```

Usage pattern in a client component:
```tsx
"use client";
import { useRef } from "react"; import gsap from "gsap"; import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);
export function ResultPanel({ result }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      thumpStamp(root.current!.querySelector(".stamp")!, root.current!);
      sweepHighlights(root.current!); countUp(root.current!.querySelector(".pct")!, Math.round(result.aiProbability * 100));
    });
    mm.add("(prefers-reduced-motion: reduce)", () => gsap.set(root.current!.querySelectorAll(".hl, .stamp"), { clearProps: "all" }));
  }, { scope: root, dependencies: [result] });
  return <div ref={root}>{/* ... */}</div>;
}
```
Rules: animate only `transform`, `opacity` and `background-size`; every effect has a reduced-motion fallback (end state, no movement); total intro under 1.8s; never block input while animating; GSAP `matchMedia` and `useGSAP` clean up automatically.

## 9. Interactive details

- **Linked highlights:** hovering or focusing an evidence item pulses its highlight in the text, and the reverse. Also scrolls the highlight into view.
- **Sample chips:** "Try a human sample" and "Try an AI sample" fill the paper (so a visitor sees the product work in 5 seconds).
- **Show marginalia** toggle (on by default) hides the handwritten notes for a cleaner view.
- **Copy summary** button: copies "txt: 72% likely AI-written (medium confidence). Estimate, not proof." to the clipboard.
- **Keyboard:** `Ctrl/Cmd + Enter` analyses, `Esc` clears the result.
- **Drag and drop:** the file area behaves like a tray, the sheet tilts slightly when a file is held above it.
- **Print:** `print.css` removes the desk, buttons and animation, keeps the stamp, the figures and the evidence (a clean one-page report).

## 10. Microcopy

| Place | Text |
|---|---|
| Empty paste area | "Paste a review, an essay or any text. Around 40 words or more works best." |
| Short text | "This text is short. Results are less reliable under about 40 words." |
| Likely AI | "Reads as likely AI-written" |
| Uncertain | "Could be either. The signals are mixed." |
| Likely human | "Reads as likely human-written" |
| Disclaimer | "txt gives a probability, not proof. Detectors can be wrong, and people use AI tools to polish honest writing. Do not use this result alone to judge someone." |
| Reviews summary | "About {x}% of the analysed reviews look AI-written (range {lo}-{hi}%)." |
| Error | "Something went wrong on our side. Please try again." |

## 11. Responsive and accessibility

- Mobile first. Below 768px the sheet fills the width with 16px padding, the margin notes move below the text, the stamp scales down.
- Contrast: body text at least 4.5:1, signal colours always paired with a word (stamp text), never colour alone.
- Visible focus on every control, `aria-live="polite"` for results, labels for every input, `lang="en"` set.
- Reduced motion handled as in section 8. Tap targets 44px.

## 12. Do and don't

Do: use real paper contrast, generous margins, one accent animation per moment, honest ranges.
Don't: use gradients, glassmorphism, neon, emoji or dark-pattern urgency; don't use the word "fake"; don't animate large blurred shadows (slow on mobile); don't use more than the four fonts above.

## 13. Design QA checklist

- [ ] Fonts load with no layout shift, fallback stacks defined
- [ ] Sheet, ruled lines, stamp, highlight and margin notes match the tokens
- [ ] Intro, stamp, highlight sweep, count-up and scroll reveal work and clean up on navigation
- [ ] Reduced-motion mode shows the same content with no movement
- [ ] Keyboard-only run through all three pages
- [ ] 360px, 768px, 1280px screenshots reviewed
- [ ] Print view of a result looks like a tidy one-page report
- [ ] Lighthouse accessibility score checked, and the contrast of every text colour verified