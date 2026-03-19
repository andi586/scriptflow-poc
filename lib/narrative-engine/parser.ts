import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { NEL_SENTINEL_PROMPT } from "@/prompts/nel-sentinel";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const NarrativeAnalysisSchema = z.object({
  series_title: z.string(),
  episode: z.number(),
  episode_title: z.string(),
  narrative_arc: z.string().min(10),
  tone: z.string().min(5),
  visual_style: z.string().min(5),
  characters: z
    .array(
      z.object({
        name: z.string(),
        role: z.enum([
          "protagonist_female",
          "protagonist_male",
          "supporting",
          "background",
        ]),
        appearance: z.string(),
        personality: z.string(),
        language_fingerprint: z.string(),
      }),
    )
    .min(1),
  beats: z
    .array(
      z.object({
        beat_number: z.number(),
        description: z.string(),
        emotion: z.string(),
        narrative_function: z.string(),
        foreshadowing: z.string().nullable(),
      }),
    )
    .min(1),
  foreshadowing_map: z.array(
    z.object({
      symbol: z.string(),
      planted_at_beat: z.number(),
      reinforced_at_beats: z.array(z.number()),
      resolved_at_beat: z.number(),
      significance: z.string(),
    }),
  ),
  core_visual_symbols: z.array(z.string()),
  cross_episode_continuity_notes: z.string(),
});

export type NarrativeAnalysis = z.infer<typeof NarrativeAnalysisSchema>;

export async function parseScript(scriptText: string): Promise<NarrativeAnalysis> {
  if (!scriptText || scriptText.trim().length < 50) {
    throw new Error("剧本内容太短，无法解析");
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: NEL_SENTINEL_PROMPT,
    messages: [
      {
        role: "user",
        content: `请分析以下短剧剧本：\n\n${scriptText}\n\n输出完整的故事记忆库JSON。`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("Claude未返回文本内容");
  }

  let jsonText = textContent.text.trim();
  if (jsonText.startsWith("`")) {
    jsonText = jsonText
      .replace(/`json?\n?/, "")
      .replace(/```$/, "")
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`JSON解析失败：${jsonText.substring(0, 200)}`);
  }

  const result = NarrativeAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`叙事分析结构不完整：${result.error.message}`);
  }

  return result.data;
}

