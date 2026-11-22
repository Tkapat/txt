export interface Chunk {
  index: number;
  start: number;
  end: number;
  text: string;
}

export function chunkText(
  text: string,
  size = 160,
  stride = 120,
  minWords = 60,
): Chunk[] {
  const spans = [...text.matchAll(/\S+/g)].map((m) => ({
    s: m.index!,
    e: m.index! + m[0].length,
  }));
  const out: Chunk[] = [];
  for (let i = 0; i < spans.length; i += stride) {
    const slice = spans.slice(i, i + size);
    if (slice.length < minWords && i > 0) break;
    const start = slice[0].s;
    const end = slice[slice.length - 1].e;
    out.push({ index: out.length, start, end, text: text.slice(start, end) });
    if (i + size >= spans.length) break;
  }
  return out;
}
