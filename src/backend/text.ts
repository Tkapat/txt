export const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

export function countWords(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}

export function normalizeText(raw: string): string {
  return raw
    .replaceAll("\u2019", "'")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
