import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeForScript } from "@/lib/ai/claude-script";
import { safeParseJSON } from "@/lib/utils/parse-json";

const BlueprintRequestSchema = z.object({
  idea: z.string().min(5),
  selectedDirection: z.string().min(10),
  totalEpisodes: z.union([z.literal(3), z.literal(6), z.literal(9)]),
});

const ExpandedStorySchema = z.object({
  title: z.string().min(1),
  logline: z.string().min(1),
  world: z.string().min(1),
  tone: z.string().min(1),
  coreConflict: z.string().min(1),
  characterDynamics: z.string().min(1),
});

const CharacterSchema = z.object({
  name: z.string().min(1),
  role: z.string().transform((val) => {
    if (val === "protagonist" || val === "antagonist" || val === "supporting") {
      return val;
    }
    // Map other Claude role values to canonical roles.
    if (val.includes("主角") || val.includes("protagonist") || val.includes("hero")) {
      return "protagonist";
    }
    if (val.includes("反派") || val.includes("villain") || val.includes("antagonist")) {
      return "antagonist";
    }
    return "supporting";
  }) as z.ZodType<"protagonist" | "antagonist" | "supporting">,
  personality: z.string().min(1),
  goal: z.string().min(1),
});

const EpisodeOutlineSchema = z.object({
  episode: z.number().int().positive(),
  summary: z.string().min(1),
});

const StructureSchema = z.object({
  threeAct: z.object({
    setup: z.string().min(1),
    confrontation: z.string().min(1),
    resolution: z.string().min(1),
  }),
  characters: z.array(CharacterSchema).min(1),
  episodes: z.array(EpisodeOutlineSchema),
  foreshadowing: z.array(z.string().min(1)).min(3),
});

const BlueprintResponseSchema = z.object({
  expandedStory: ExpandedStorySchema,
  structure: StructureSchema,
});

type BlueprintRequest = z.infer<typeof BlueprintRequestSchema>;

function buildPrompt(input: BlueprintRequest): string {
  return `你是资深短剧编剧与结构设计师。

用户原始灵感："${input.idea}"
用户选择的故事方向："${input.selectedDirection}"
目标集数：${input.totalEpisodes} 集

一次性完成以下任务，只输出JSON：

1. 深化故事设定
2. 三幕式结构
3. 角色列表（3-6人）
4. 仅生成${input.totalEpisodes}集大纲
5. 至少3个伏笔

输出格式：
{"expandedStory":{"title":"...","logline":"...","world":"...","tone":"...","coreConflict":"...","characterDynamics":"..."},"structure":{"threeAct":{"setup":"...","confrontation":"...","resolution":"..."},"characters":[{"name":"...","role":"protagonist","personality":"...","goal":"..."}],"episodes":[{"episode":1,"summary":"..."}],"foreshadowing":["...","...","..."]}}

严格要求：
- episodes只输出${input.totalEpisodes}集，从1连续编号
- 不要同时输出三种集数版本
- 只输出JSON，不要其他文字`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const input = BlueprintRequestSchema.parse(body);
    const prompt = buildPrompt(input);
    const raw = await callClaudeForScript(prompt);
    const parsed = safeParseJSON<unknown>(raw);

    // 修正Claude可能输出的扁平结构
    const data = parsed as Record<string, unknown>;
    const structure =
      typeof data.structure === "object" && data.structure !== null
        ? (data.structure as Record<string, unknown>)
        : {};
    const normalized = {
      expandedStory: data.expandedStory ?? data,
      structure: {
        threeAct: structure.threeAct ?? data.threeAct,
        characters: structure.characters ?? data.characters,
        episodes: structure.episodes ?? data.episodes,
        foreshadowing: structure.foreshadowing ?? data.foreshadowing,
      },
    };
    const validated = BlueprintResponseSchema.parse(normalized);

    if (validated.structure.episodes.length !== input.totalEpisodes) {
      return NextResponse.json(
        {
          error: `Expected ${input.totalEpisodes} episodes, got ${validated.structure.episodes.length}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(validated);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
