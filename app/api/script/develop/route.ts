import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeForScript } from "@/lib/ai/claude-script";
import { safeParseJSON } from "@/lib/utils/parse-json";

export const maxDuration = 300;

const ExploreRequestSchema = z.object({
  mode: z.literal("explore"),
  idea: z.string().min(5),
});

const ExpandRequestSchema = z.object({
  mode: z.literal("expand"),
  idea: z.string().min(5),
  selectedDirection: z.string().min(10),
});

const DirectionSchema = z.object({
  title: z.string(),
  summary: z.string().max(120),
  style: z.string(),
});

const ExploreResponseSchema = z.object({
  coreConflict: z.string(),
  theme: z.string(),
  emotionalHook: z.string(),
  directions: z.array(DirectionSchema).length(3),
});

const ExpandResponseSchema = z.object({
  title: z.string(),
  logline: z.string(),
  world: z.string(),
  tone: z.string(),
  coreConflict: z.string(),
  characterDynamics: z.string(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    if (
      typeof body === "object" &&
      body !== null &&
      "mode" in body &&
      (body as Record<string, unknown>).mode === "explore"
    ) {
      const parsed = ExploreRequestSchema.parse(body);
      const prompt = `你是专业短剧编剧。用户灵感："${parsed.idea}"
请输出核心冲突、主题、情感钩子、三个完全不同风格的故事方向（每个100字以内）。
只输出JSON，格式：
{"coreConflict":"...","theme":"...","emotionalHook":"...","directions":[{"title":"...","summary":"...","style":"..."},{"title":"...","summary":"...","style":"..."},{"title":"...","summary":"...","style":"..."}]}`;

      const raw = await callClaudeForScript(prompt);
      const validated = ExploreResponseSchema.parse(safeParseJSON(raw));
      return NextResponse.json(validated);
    }

    if (
      typeof body === "object" &&
      body !== null &&
      "mode" in body &&
      (body as Record<string, unknown>).mode === "expand"
    ) {
      const parsed = ExpandRequestSchema.parse(body);
      const prompt = `你是资深影视编剧。原始灵感："${parsed.idea}"，用户选择方向："${parsed.selectedDirection}"
请深化为完整故事设定。只输出JSON，格式：
{"title":"...","logline":"...","world":"...","tone":"...","coreConflict":"...","characterDynamics":"..."}`;

      const raw = await callClaudeForScript(prompt);
      const validated = ExpandResponseSchema.parse(safeParseJSON(raw));
      return NextResponse.json(validated);
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
