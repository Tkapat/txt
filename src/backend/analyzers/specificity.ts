export function specificity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const numbers = (text.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).length;
  const units = (
    text.match(
      /\b\d+\s?(?:mm|cm|kg|g|ml|oz|lb|hours?|days?|weeks?|months?|years?)\b/gi,
    ) ?? []
  ).length;
  const proper = (text.match(/(?<=[a-z,]\s)[A-Z][a-z]{2,}/g) ?? []).length;
  const experience = (
    text.match(
      /\b(after|since|bought|ordered|returned|broke|stopped|replaced)\b/gi,
    ) ?? []
  ).length;
  return Math.min(1, ((numbers + 2 * units + proper + experience) / words) * 6);
}
