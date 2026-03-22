import Anthropic from "@anthropic-ai/sdk";
import { NEL_SENTINEL_PROMPT, NEL_SENTINEL_PROMPT_LAZY } from "@/prompts/nel-sentinel";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NarrativeAnalysis = Record<string, unknown>;

/** full = 原版 Sentinel（质量高、更慢）；lazy = 精简提示 + 更低 max_tokens，可选 Haiku（见环境变量） */
export type NelParseProfile = "full" | "lazy";

const DEFAULT_SONNET = "claude-sonnet-4-20250514";
/** 懒人 NEL 默认用 Haiku 降延迟；可在 Vercel 设为 sonnet：NEL_LAZY_MODEL=claude-sonnet-4-20250514 */
const DEFAULT_LAZY_MODEL =
  process.env.NEL_LAZY_MODEL?.trim() || "claude-3-5-haiku-20241022";

export async function parseScript(
  scriptText: string,
  options?: { profile?: NelParseProfile },
): Promise<NarrativeAnalysis> {
  if (!scriptText || scriptText.trim().length < 50) {
    throw new Error("剧本内容太短，无法解析");
  }

  const profile = options?.profile ?? "full";
  const lazy = profile === "lazy";
  const system = lazy ? NEL_SENTINEL_PROMPT_LAZY : NEL_SENTINEL_PROMPT;
  const model = lazy ? DEFAULT_LAZY_MODEL : DEFAULT_SONNET;
  const max_tokens = lazy ? 3072 : 4096;

  const message = await client.messages.create({
    model,
    max_tokens,
    system,
    messages: [
      {
        role: "user",
        content: lazy
          ? `请分析以下短剧剧本（输出紧凑 JSON）：\n\n${scriptText}`
          : `请分析以下短剧剧本：\n\n${scriptText}\n\n输出完整的故事记忆库JSON。`,
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("Claude未返回文本内容");
  }

  let jsonText = textContent.text.trim();
  // Claude sometimes wraps JSON in markdown code fences; strip them first.
  jsonText = jsonText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`JSON解析失败：${jsonText.substring(0, 200)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Claude返回的不是一个JSON对象");
  }

  // No schema validation: return whatever Claude produced.
  return parsed as NarrativeAnalysis;
}

