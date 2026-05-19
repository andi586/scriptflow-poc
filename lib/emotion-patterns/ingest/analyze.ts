import Anthropic from "@anthropic-ai/sdk";
import { safeParseJSON } from "@/lib/utils/parse-json";
import {
  EmotionPatternAnalysisSchema,
  type EmotionPatternAnalysis,
} from "@/lib/emotion-patterns/ingest/schema";
import {
  EMOTION_PATTERN_INGEST_SYSTEM_PROMPT,
  buildEmotionPatternIngestUserPrompt,
} from "@/lib/emotion-patterns/ingest/prompt";

const OPENROUTER_MODEL =
  process.env.EMOTION_PATTERN_INGEST_MODEL ?? "anthropic/claude-sonnet-4-5";

export type IngestErrorStage = "ai_call" | "ai_parse" | "validation";

export class EmotionPatternAnalyzeError extends Error {
  readonly stage: IngestErrorStage;
  readonly details?: unknown;

  constructor(
    stage: IngestErrorStage,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "EmotionPatternAnalyzeError";
    this.stage = stage;
    this.details = details;
  }
}

function getOpenRouterClient(): Anthropic {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new EmotionPatternAnalyzeError(
      "ai_call",
      "Missing OPENROUTER_API_KEY",
    );
  }
  return new Anthropic({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://getscriptflow.com",
      "X-Title": "ScriptFlow Emotion Pattern Ingest",
    },
  });
}

function roundScore(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function analyzeRawTextForEmotionPattern(
  rawText: string,
): Promise<EmotionPatternAnalysis> {
  const client = getOpenRouterClient();

  let message;
  try {
    message = await client.messages.create({
      model: OPENROUTER_MODEL,
      max_tokens: 2048,
      system: EMOTION_PATTERN_INGEST_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildEmotionPatternIngestUserPrompt(rawText),
        },
      ],
    });
  } catch (err) {
    throw new EmotionPatternAnalyzeError(
      "ai_call",
      err instanceof Error ? err.message : "OpenRouter request failed",
      err,
    );
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    throw new EmotionPatternAnalyzeError("ai_parse", "Empty model response");
  }

  const parsed = safeParseJSON<unknown>(text);
  if (parsed === null) {
    throw new EmotionPatternAnalyzeError(
      "ai_parse",
      "Failed to parse model JSON",
      { raw_preview: text.slice(0, 500) },
    );
  }

  const normalized =
    typeof parsed === "object" && parsed !== null
      ? {
          ...parsed,
          universality_score:
            typeof (parsed as Record<string, unknown>).universality_score ===
            "number"
              ? roundScore(
                  (parsed as Record<string, unknown>).universality_score as number,
                )
              : (parsed as Record<string, unknown>).universality_score,
          shareability_score:
            typeof (parsed as Record<string, unknown>).shareability_score ===
            "number"
              ? roundScore(
                  (parsed as Record<string, unknown>).shareability_score as number,
                )
              : (parsed as Record<string, unknown>).shareability_score,
          watchtime_score:
            typeof (parsed as Record<string, unknown>).watchtime_score ===
            "number"
              ? roundScore(
                  (parsed as Record<string, unknown>).watchtime_score as number,
                )
              : (parsed as Record<string, unknown>).watchtime_score,
        }
      : parsed;

  const result = EmotionPatternAnalysisSchema.safeParse(normalized);
  if (!result.success) {
    throw new EmotionPatternAnalyzeError(
      "validation",
      "AI output failed schema validation",
      result.error.flatten(),
    );
  }

  return result.data;
}
