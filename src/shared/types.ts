export type ModelKey = "review" | "document";
export type Verdict = "likely_ai" | "uncertain" | "likely_human";
export type Confidence = "low" | "medium" | "high";
export type Warning =
  | "short_text"
  | "english_only"
  | "scanned_pdf"
  | "truncated"
  | "detector_not_proof";

export interface PhraseEvidence {
  text: string;
  start: number;
  end: number;
  weight: number;
  reviewId?: string;
}

export interface Cue {
  label: string;
  direction: "toward_ai" | "toward_human";
}

export interface TextResult {
  aiProbability: number;
  verdict: Verdict;
  confidence: Confidence;
  wordCount: number;
  model: ModelKey;
  modelVersion: string;
  evidence: PhraseEvidence[];
  cues: Cue[];
  warnings: Warning[];
}

export interface ChunkResult {
  index: number;
  start: number;
  end: number;
  aiProbability: number;
  flagged: boolean;
}

export interface DocumentResult extends TextResult {
  chunks: ChunkResult[];
  flaggedShare: number;
  source?: { fileName: string; chars: number };
}

export interface ReviewInput {
  id?: string;
  text: string;
  rating?: number;
}

export interface ReviewScore {
  id: string;
  aiProbability: number;
  flagged: boolean;
  verdict: Verdict;
  wordCount: number;
}

export interface Prevalence {
  observed: number;
  estimated: number;
  low: number;
  high: number;
}

export interface ReviewsReport {
  total: number;
  analyzed: number;
  skippedShort: number;
  flaggedCount: number;
  prevalence: Prevalence;
  topEvidence: PhraseEvidence[];
  groupSignals: { clusters: number; reviewsInClusters: number; note: string };
  reviews: ReviewScore[];
  modelVersion: string;
  warnings: Warning[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
