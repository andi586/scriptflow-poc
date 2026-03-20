import Anthropic from "@anthropic-ai/sdk";
import { NEL_SENTINEL_PROMPT } from "@/prompts/nel-sentinel";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NarrativeAnalysis = Record<string, unknown>;

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

