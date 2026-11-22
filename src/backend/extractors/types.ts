export interface ExtractedUnit {
  id: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface FileInfo {
  name: string;
  mime: string;
  size: number;
}

export interface Extractor {
  id: string;
  accepts(file: FileInfo): boolean;
  extract(buffer: Buffer): Promise<ExtractedUnit[]>;
}
