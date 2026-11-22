export interface Unit {
  text: string;
  start: number;
  end: number;
}

export function splitUnits(
  text: string,
  re = /[^.!?]+[.!?]*\s*/g,
): Unit[] {
  const out: Unit[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const trimmed = match[0].trim();
    if (!trimmed) continue;
    const start = match.index + match[0].indexOf(trimmed);
    out.push({ text: trimmed, start, end: start + trimmed.length });
  }
  return out;
}

export const splitClauses = (text: string): Unit[] =>
  splitUnits(text, /[^,;\u2014]+[,;\u2014]?\s*/g);

export function truncateWords(text: string, max = 22): string {
  const words = text.split(/\s+/);
  return words.length <= max
    ? text
    : words.slice(0, max).join(" ") + "\u2026";
}
