import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  analyzeRawTextForEmotionPattern,
  EmotionPatternAnalyzeError,
} from "@/lib/emotion-patterns/ingest/analyze";
import { logIngestionError } from "@/lib/emotion-patterns/ingest/log-error";
import {
  analysisToInsertPayload,
  IngestRequestSchema,
} from "@/lib/emotion-patterns/ingest/schema";
import type {
  EmotionPatternIngestErrorResponse,
  EmotionPatternIngestSuccessResponse,
} from "@/types/emotion-pattern-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized(): NextResponse<EmotionPatternIngestErrorResponse> {
  return NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 },
  );
}

function checkIngestAuth(req: NextRequest): boolean {
  const secret = process.env.EMOTION_PATTERN_INGEST_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-ingest-secret");
  return header === secret;
}

/**
 * POST /api/emotion-patterns/ingest
 *
 * Body: { "raw_text": string }
 *
 * Pipeline: validate → OpenRouter Claude analysis → Zod → insert emotion_patterns
 * On failure: insert ingestion_errors (if table exists)
 */
export async function POST(req: NextRequest) {
  if (!checkIngestAuth(req)) {
    return unauthorized();
  }

  let rawText = "";

  try {
    const body: unknown = await req.json();
    const { raw_text } = IngestRequestSchema.parse(body);
    rawText = raw_text;

    const analysis = await analyzeRawTextForEmotionPattern(rawText);
    const payload = analysisToInsertPayload(analysis, rawText);

    const { data, error } = await supabaseAdmin
      .from("emotion_patterns")
      .insert({
        pattern_name: payload.pattern_name,
        category: payload.category,
        setup_structure: payload.setup_structure,
        reversal_structure: payload.reversal_structure,
        emotion_trigger: payload.emotion_trigger,
        retention_trigger: payload.retention_trigger,
        viral_mechanism: payload.viral_mechanism,
        cognitive_pattern: payload.cognitive_pattern,
        example_text: payload.example_text,
        example_analysis: payload.example_analysis,
        platform: payload.platform,
        language: payload.language,
        universality_score: payload.universality_score,
        shareability_score: payload.shareability_score,
        watchtime_score: payload.watchtime_score,
        tags: payload.tags,
        source_type: payload.source_type,
      })
      .select("*")
      .single();

    if (error) {
      const ingestionErrorId = await logIngestionError({
        rawText,
        stage: "db_insert",
        message: error.message,
        details: { code: error.code, hint: error.hint },
      });

      const response: EmotionPatternIngestErrorResponse = {
        ok: false,
        error: `Database insert failed: ${error.message}`,
        stage: "db_insert",
        ingestion_error_id: ingestionErrorId,
      };
      return NextResponse.json(response, { status: 500 });
    }

    const success: EmotionPatternIngestSuccessResponse = {
      ok: true,
      pattern: data,
      analysis,
    };
    return NextResponse.json(success, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues.map((issue) => issue.message).join("; ");
      const ingestionErrorId = rawText
        ? await logIngestionError({
            rawText,
            stage: "validation",
            message,
            details: err.flatten(),
          })
        : null;

      return NextResponse.json(
        {
          ok: false,
          error: message,
          stage: "validation",
          ingestion_error_id: ingestionErrorId,
        } satisfies EmotionPatternIngestErrorResponse,
        { status: 400 },
      );
    }

    if (err instanceof EmotionPatternAnalyzeError) {
      const ingestionErrorId = rawText
        ? await logIngestionError({
            rawText,
            stage: err.stage,
            message: err.message,
            details: err.details,
          })
        : null;

      const status =
        err.stage === "validation" ? 422 : err.stage === "ai_parse" ? 502 : 503;

      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          stage: err.stage,
          ingestion_error_id: ingestionErrorId,
        } satisfies EmotionPatternIngestErrorResponse,
        { status },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    const ingestionErrorId = rawText
      ? await logIngestionError({
          rawText,
          stage: "ai_call",
          message,
        })
      : null;

    return NextResponse.json(
      {
        ok: false,
        error: message,
        stage: "ai_call",
        ingestion_error_id: ingestionErrorId,
      } satisfies EmotionPatternIngestErrorResponse,
      { status: 500 },
    );
  }
}
