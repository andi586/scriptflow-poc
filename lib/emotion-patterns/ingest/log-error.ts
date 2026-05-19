import { supabaseAdmin } from "@/lib/supabase/admin";
import type { IngestErrorStage } from "@/lib/emotion-patterns/ingest/analyze";

export type IngestionErrorStage =
  | IngestErrorStage
  | "validation"
  | "db_insert";

export async function logIngestionError(params: {
  rawText: string;
  stage: IngestionErrorStage;
  message: string;
  details?: unknown;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("ingestion_errors")
      .insert({
        raw_text: params.rawText,
        error_stage: params.stage,
        error_message: params.message.slice(0, 2000),
        error_details: params.details ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ingestion_errors] insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error(
      "[ingestion_errors] unexpected:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
