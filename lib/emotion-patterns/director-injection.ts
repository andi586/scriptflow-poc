import { supabaseAdmin } from "@/lib/supabase/admin";

/** Fields injected into Director Brain as upper-level cognitive mechanisms */
export type EmotionPatternDirectorSlice = {
  pattern_name: string;
  viral_mechanism: string[] | null;
  cognitive_pattern: string | null;
  retention_trigger: string | null;
};

type EmotionLineSlice = {
  text: string;
  why_it_hurts: string | null;
  human_detail: string | null;
};

type EmotionDetailSlice = {
  text: string;
  visual_symbol: string | null;
  human_truth: string | null;
};

const PATTERN_LIMIT = 5;
const LINE_LIMIT = 5;
const DETAIL_LIMIT = 3;

/**
 * Load top emotion_patterns by universality_score.
 * Returns [] on missing table, query error, or network failure (non-fatal).
 */
export async function loadEmotionPatternsForDirector(
  limit: number = PATTERN_LIMIT,
): Promise<EmotionPatternDirectorSlice[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("emotion_patterns")
      .select(
        "pattern_name, viral_mechanism, cognitive_pattern, retention_trigger",
      )
      .order("universality_score", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(
        "[generate-script] emotion_patterns load failed:",
        error.message,
      );
      return [];
    }

    const rows = (data ?? []) as EmotionPatternDirectorSlice[];
    console.log("[generate-script] loaded emotion_patterns count:", rows.length);
    return rows;
  } catch (err) {
    console.warn(
      "[generate-script] emotion_patterns load error:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

function formatPatternBlock(patterns: EmotionPatternDirectorSlice[]): string {
  if (patterns.length === 0) return "";

  const entries = patterns
    .map((p) => {
      const mechanisms = (p.viral_mechanism ?? []).join(", ") || "n/a";
      const cognitive = p.cognitive_pattern?.trim() || "n/a";
      const retention = p.retention_trigger?.trim() || "n/a";
      return `- ${p.pattern_name}
  viral_mechanism: ${mechanisms}
  cognitive_pattern: ${cognitive}
  retention_trigger: ${retention}`;
    })
    .join("\n");

  return `
═══ COGNITIVE PATTERN LAYER (upper-level viral mechanisms — framing only) ═══
Use these as meta-directives for structure and audience cognition. Do NOT replace dialogue from EMOTION LIBRARY below.

${entries}
═══ END COGNITIVE PATTERN LAYER ═══
`;
}

/**
 * Builds full emotion injection: patterns (upper layer) + lines + details.
 */
export function buildDirectorEmotionInjection(
  emotionLines: EmotionLineSlice[] | null | undefined,
  emotionDetails: EmotionDetailSlice[] | null | undefined,
  emotionPatterns: EmotionPatternDirectorSlice[],
): string {
  const patternBlock = formatPatternBlock(emotionPatterns);

  const linesBlock =
    emotionLines && emotionLines.length > 0
      ? `
EMOTION LIBRARY (draw from these):
${emotionLines.map((l) => `- "${l.text}" (${l.why_it_hurts ?? ""})`).join("\n")}
`
      : "";

  const detailsBlock =
    emotionDetails && emotionDetails.length > 0
      ? `
HUMAN DETAILS (use as visual anchors):
${emotionDetails.map((d) => `- ${d.text}: ${d.visual_symbol ?? ""}`).join("\n")}
`
      : "";

  return `${patternBlock}${linesBlock}${detailsBlock}`;
}

export const EMOTION_CATALOG_LIMITS = {
  patterns: PATTERN_LIMIT,
  lines: LINE_LIMIT,
  details: DETAIL_LIMIT,
} as const;
