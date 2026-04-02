import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeForScript } from "@/lib/ai/claude-script";
import { safeParseJSON } from "@/lib/utils/parse-json";

export const maxDuration = 300;

const StructureRequestSchema = z.object({
  title: z.string(),
  logline: z.string(),
  world: z.string(),
  tone: z.string(),
  coreConflict: z.string(),
  characterDynamics: z.string(),
  totalEpisodes: z.union([z.literal(3), z.literal(6), z.literal(9)]),
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
  episodes: z.array(EpisodeSchema).min(3).max(9),
  foreshadowing: z.array(z.string()).min(3),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = StructureRequestSchema.parse(body);

    const prompt = `你是剧本结构专家。
故事：标题${parsed.title}，一句话${parsed.logline}，世界观${parsed.world}，基调${parsed.tone}，核心冲突${parsed.coreConflict}，人物关系${parsed.characterDynamics}

只输出JSON，不输出任何解释文字。

要求：
1) 只生成“${parsed.totalEpisodes}集”的剧情大纲，不要同时生成3/6/9的其他版本
2) episodes 只输出一个数组：包含 episode:1..${parsed.totalEpisodes} 共 ${parsed.totalEpisodes} 项
3) foreshadowing 至少3条

只输出JSON，格式：
{"threeAct":{"setup":"...","confrontation":"...","resolution":"..."},"characters":[{"name":"...","role":"protagonist","personality":"...","goal":"..."}],"episodes":[{"episode":1,"summary":"..."},{"episode":2,"summary":"..."}],"foreshadowing":["...","...","..."]}`;

    const raw = await callClaudeForScript(prompt);
    const validated = StructureResponseSchema.parse(safeParseJSON(raw));

    if (validated.episodes.length !== parsed.totalEpisodes) {
      return NextResponse.json(
        { error: `episodes length mismatch, expected ${parsed.totalEpisodes} got ${validated.episodes.length}` },
        { status: 500 }
      );
    }

    return NextResponse.json(validated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
