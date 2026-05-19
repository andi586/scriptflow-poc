import { z } from "zod";

/** POST /api/emotion-patterns/ingest body */
export const IngestRequestSchema = z.object({
  raw_text: z
    .string()
    .trim()
    .min(1, "raw_text is required")
    .max(12_000, "raw_text exceeds 12000 characters"),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

const nonEmpty = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} must not be empty`);

const score = z
  .number()
  .min(0, "score must be >= 0")
  .max(10, "score must be <= 10");

/** Allowed pattern families for ingestion */
export const EmotionPatternCategoryEnum = z.enum([
  "viral_hook",
  "golden_line",
  "comment_reply",
  "dark_humor",
  "dark_humor_reversal",
  "counter_expectation",
  "emotion_reversal",
  "moral_misalignment",
  "retention_mechanic",
]);

export const EmotionPatternSourceTypeEnum = z.enum([
  "comment",
  "hook",
  "script",
  "manual",
  "benchmark",
  "import",
  "tiktok_comment",
]);

/**
 * Strict AI analysis output — every field required, no empty strings/arrays.
 * Validated before any write to emotion_patterns.
 */
export const EmotionPatternAnalysisSchema = z.object({
  pattern_name: nonEmpty("pattern_name"),
  category: EmotionPatternCategoryEnum,
  setup_structure: nonEmpty("setup_structure"),
  reversal_structure: nonEmpty("reversal_structure"),
  emotion_trigger: nonEmpty("emotion_trigger"),
  retention_trigger: nonEmpty("retention_trigger"),
  viral_mechanism: z
    .array(nonEmpty("viral_mechanism item"))
    .min(1, "viral_mechanism must have at least one tag"),
  cognitive_pattern: nonEmpty("cognitive_pattern"),
  example_analysis: nonEmpty("example_analysis"),
  platform: nonEmpty("platform"),
  language: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[a-z]{2}(-[a-z]{2})?$/i, "language must be like zh or en"),
  universality_score: score,
  shareability_score: score,
  watchtime_score: score,
  tags: z.array(nonEmpty("tag")).min(1, "tags must have at least one entry"),
  source_type: EmotionPatternSourceTypeEnum,
});

export type EmotionPatternAnalysis = z.infer<typeof EmotionPatternAnalysisSchema>;

/**
 * Full row payload for Supabase insert — derived from analysis + raw_text.
 * All nullable columns in DB are required here (no empty writes).
 */
export const EmotionPatternInsertPayloadSchema = EmotionPatternAnalysisSchema.extend({
  example_text: nonEmpty("example_text"),
}).strict();

export type EmotionPatternInsertPayload = z.infer<
  typeof EmotionPatternInsertPayloadSchema
>;

export function analysisToInsertPayload(
  analysis: EmotionPatternAnalysis,
  rawText: string,
): EmotionPatternInsertPayload {
  return EmotionPatternInsertPayloadSchema.parse({
    ...analysis,
    example_text: rawText.trim(),
  });
}
