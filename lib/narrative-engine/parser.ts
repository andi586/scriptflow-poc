import Anthropic from "@anthropic-ai/sdk";
import { NEL_SENTINEL_PROMPT, NEL_SENTINEL_PROMPT_LAZY } from "@/prompts/nel-sentinel";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NarrativeAnalysis = Record<string, unknown>;

/** full = 原版 Sentinel（质量高、更慢）；lazy = 精简提示 + 更低 max_tokens，可选 Haiku（见环境变量） */
export type NelParseProfile = "full" | "lazy";

const DEFAULT_SONNET = "claude-sonnet-4-20250514";
/** 懒人 NEL 默认用 Haiku 降延迟；可在 Vercel 设为 sonnet：NEL_LAZY_MODEL=claude-sonnet-4-20250514 */
const DEFAULT_LAZY_MODEL =
  process.env.NEL_LAZY_MODEL?.trim() || "claude-haiku-4-5-20251001";
/** Keep Claude prompt payload compact to reduce serverless timeout risk. */
const NEL_PROMPT_BUDGET_CHARS = 2000;
/** Must stay at the top of system prompt so truncation never drops it. */
const NEL_OUTPUT_GUARD =
  "Respond ONLY in English. Do not use any Chinese characters in your response. Return pure JSON only, no markdown, no explanation.";

function trimToChars(input: string, maxChars: number): string {
  if (maxChars <= 0) return "";
  const s = input.trim();
  if (s.length <= maxChars) return s;
  if (maxChars <= 24) return s.slice(0, maxChars);
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head - 15;
  return `${s.slice(0, head)}\n...[truncated]...\n${s.slice(Math.max(0, s.length - tail))}`;
}

function buildBoundedNelPayload(
  systemBase: string,
  userBase: string,
): { system: string; user: string } {
  // Prefer preserving script context in user prompt while keeping system concise.
  const system = trimToChars(systemBase, Math.floor(NEL_PROMPT_BUDGET_CHARS * 0.45));
  const remaining = Math.max(120, NEL_PROMPT_BUDGET_CHARS - system.length);
  let user = trimToChars(userBase, remaining);
  if (system.length + user.length > NEL_PROMPT_BUDGET_CHARS) {
    user = trimToChars(user, NEL_PROMPT_BUDGET_CHARS - system.length);
  }
  return { system, user };
}

export async function parseScript(
  scriptText: string,
  options?: { profile?: NelParseProfile },
): Promise<NarrativeAnalysis> {
  if (!scriptText || scriptText.trim().length < 50) {
    throw new Error("剧本内容太短，无法解析");
  }

  const profile = options?.profile ?? "full";
  const lazy = profile === "lazy";
  const systemBase = `${NEL_OUTPUT_GUARD}\n\n${
    lazy ? NEL_SENTINEL_PROMPT_LAZY : NEL_SENTINEL_PROMPT
  }`;
  const userBase = lazy
    ? `Important: All field values must be in English only.\nAnalyze the short drama script below and return compact valid JSON:\n\n${scriptText}`
    : `Important: All field values must be in English only.\nAnalyze the short drama script below:\n\n${scriptText}\n\nReturn complete story-memory JSON.`;
  const { system, user } = buildBoundedNelPayload(systemBase, userBase);
  const model = lazy ? DEFAULT_LAZY_MODEL : DEFAULT_SONNET;
  const max_tokens = lazy ? 3072 : 4096;

  const message = await client.messages.create({
    model,
    max_tokens,
    system,
    messages: [
      {
        role: "user",
        content: user,
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
  } catch (e) {
    console.error("[NEL parseScript] JSON parse failed. Raw Claude response:");
    console.error(textContent.text);
    throw new Error(`JSON解析失败：${jsonText.substring(0, 200)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Claude返回的不是一个JSON对象");
  }

  // No schema validation: return whatever Claude produced.
  return parsed as NarrativeAnalysis;
}

