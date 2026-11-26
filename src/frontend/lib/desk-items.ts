export type DeskItem = {
  id: string;
  src: string;
  kind: "sticker" | "sketch";
  w: number;
  h: number; // display size in px at >=1280 (matches the file aspect ratio)
  side: "l" | "r"; // which gutter
  top: number; // vh from the top of the viewport
  tuck: number; // px tucked under the sheet (<= 30% of w stickers, <= 40% sketches)
  rot: number; // degrees
  tier: "m" | "l"; // m: shows >=1024px, l: shows >=1280px only
  tape?: boolean; // saffron tape on the top corner
};

export const DESK_ITEMS: DeskItem[] = [
  { id: "note-card", src: "/stickers/sticker-01.webp", kind: "sticker", w: 190, h: 200, side: "l", top: 6, tuck: 40, rot: -6, tier: "l" },
  { id: "lined-note", src: "/stickers/sticker-02.webp", kind: "sticker", w: 170, h: 210, side: "r", top: 10, tuck: 36, rot: 5, tier: "l" },
  { id: "butterfly", src: "/stickers/sticker-04.webp", kind: "sticker", w: 120, h: 100, side: "l", top: 48, tuck: 20, rot: 8, tier: "m" },
  { id: "tag", src: "/stickers/sticker-03.webp", kind: "sticker", w: 100, h: 143, side: "r", top: 48, tuck: 24, rot: -8, tier: "m" },
  { id: "badge", src: "/stickers/sticker-05.webp", kind: "sticker", w: 130, h: 130, side: "l", top: 64, tuck: 30, rot: 4, tier: "l" },
  { id: "button", src: "/stickers/sticker-06.webp", kind: "sticker", w: 64, h: 64, side: "r", top: 74, tuck: 8, rot: 0, tier: "m" },
  { id: "daisy", src: "/stickers/sticker-07.webp", kind: "sticker", w: 72, h: 72, side: "r", top: 28, tuck: 10, rot: 9, tier: "l" },
  { id: "sketch-leaves", src: "/sketches/leaves.webp", kind: "sketch", w: 200, h: 260, side: "l", top: 32, tuck: 60, rot: -9, tier: "l", tape: true },
  { id: "sketch-flower", src: "/sketches/flower.webp", kind: "sketch", w: 180, h: 240, side: "r", top: 58, tuck: 50, rot: 6, tier: "l" },
  { id: "sketch-circuit", src: "/sketches/circuit-leaf.webp", kind: "sketch", w: 150, h: 150, side: "l", top: 87, tuck: 30, rot: -4, tier: "l", tape: true },
];
