/**
 * API types for POST /api/emotion-patterns/ingest
 */

import type { EmotionPatternAnalysis } from "@/lib/emotion-patterns/ingest/schema";
import type { EmotionPatternRow } from "@/types/emotion-patterns";

export type { EmotionPatternAnalysis } from "@/lib/emotion-patterns/ingest/schema";
export type { IngestRequest } from "@/lib/emotion-patterns/ingest/schema";

/** Successful ingest response */
export interface EmotionPatternIngestSuccessResponse {
  ok: true;
  pattern: EmotionPatternRow;
  analysis: EmotionPatternAnalysis;
}

/** Failed ingest response (error also logged to ingestion_errors when possible) */
export interface EmotionPatternIngestErrorResponse {
  ok: false;
  error: string;
  stage?: string;
  ingestion_error_id?: string | null;
}

export type EmotionPatternIngestResponse =
  | EmotionPatternIngestSuccessResponse
  | EmotionPatternIngestErrorResponse;

/** Row shape for ingestion_errors table */
export interface IngestionErrorRow {
  id: string;
  raw_text: string;
  error_stage: "validation" | "ai_call" | "ai_parse" | "db_insert";
  error_message: string;
  error_details: Record<string, unknown> | null;
  created_at: string;
}
