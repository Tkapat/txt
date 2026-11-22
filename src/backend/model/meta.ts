import fs from "node:fs/promises";
import path from "node:path";
import { META_DIR } from "@/backend/config";

const cache = new Map<string, unknown>();

export async function loadJson<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const file = path.join(META_DIR, `${name}.json`);
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as T;
    cache.set(name, parsed);
  }
  return cache.get(name) as T;
}

export function clearMetaCache(): void {
  cache.clear();
}

export interface ModelMeta {
  version: string;
  chunk: { words: number; stride: number; min_words: number };
  thresholds: { low: number; high: number };
  sensitivity_unseen: number;
  specificity: number;
}
