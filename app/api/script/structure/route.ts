import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeForScript } from "@/lib/ai/claude-script";
import { safeParseJSON } from "@/lib/utils/parse-json";

const StructureRequestSchema = z.object({
  title: z.string(),
  logline: z.string(),
  world: z.string(),
  tone: z.string(),
  coreConflict: z.string(),
  characterDynamics: z.string(),
});

const CharacterSchema = z.object({
  name: z.string(),
  role: z.enum(["protagonist", "antagonist", "supporting"]),
  personality: z.string(),
  goal: z.string(),
});

const EpisodeSchema = z.object({
  episode: z.number(),
  summary: z.string(),
});

const StructureResponseSchema = z.object({
  threeAct: z.object({
    setup: z.string(),
    confrontation: z.string(),
    resolution: z.string(),
  }),
  characters: z.array(CharacterSchema).min(1),
  episodes: z.object({
    three: z.array(EpisodeSchema).length(3),
    six: z.array(EpisodeSchema).length(6),
    nine: z.array(EpisodeSchema).length(9),
  }),
  foreshadowing: z.array(z.string()).min(3),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = StructureRequestSchema.parse(body);

    const prompt = `你是剧本结构专家。
故事：标题${parsed.title}，一句话${parsed.logline}，世界观${parsed.world}，基调${parsed.tone}，核心冲突${parsed.coreConflict}，人物关系${parsed.characterDynamics}
只输出JSON，格式：
{"threeAct":{"setup":"...","confrontation":"...","resolution":"..."},"characters":[{"name":"...","role":"protagonist","personality":"...","goal":"..."}],"episodes":{"three":[{"episode":1,"summary":"..."},{"episode":2,"summary":"..."},{"episode":3,"summary":"..."}],"six":[{"episode":1,"summary":"..."},{"episode":2,"summary":"..."},{"episode":3,"summary":"..."},{"episode":4,"summary":"..."},{"episode":5,"summary":"..."},{"episode":6,"summary":"..."}],"nine":[{"episode":1,"summary":"..."},{"episode":2,"summary":"..."},{"episode":3,"summary":"..."},{"episode":4,"summary":"..."},{"episode":5,"summary":"..."},{"episode":6,"summary":"..."},{"episode":7,"summary":"..."},{"episode":8,"summary":"..."},{"episode":9,"summary":"..."}]},"foreshadowing":["...","...","..."]}`;

    const raw = await callClaudeForScript(prompt);
    const validated = StructureResponseSchema.parse(safeParseJSON(raw));
    return NextResponse.json(validated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
