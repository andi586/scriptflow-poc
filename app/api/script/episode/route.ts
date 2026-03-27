import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeForScript } from "@/lib/ai/claude-script";
import { safeParseJSON } from "@/lib/utils/parse-json";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { submitKlingVideoTask } from "@/lib/kling-video";

// ========================
// Zod Schemas
// ========================

const CharacterSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["protagonist", "antagonist", "supporting"]),
  personality: z.string().min(1),
  goal: z.string().min(1),
});

const ThreeActSchema = z.object({
  setup: z.string().min(1),
  confrontation: z.string().min(1),
  resolution: z.string().min(1),
});

const SeasonSpecSchema = z.object({
  title: z.string().min(1),
  logline: z.string().min(1),
  world: z.string().min(1),
  tone: z.string().min(1),
  coreConflict: z.string().min(1),
  totalEpisodes: z.union([z.literal(3), z.literal(6), z.literal(9)]),
  threeAct: ThreeActSchema,
  characters: z.array(CharacterSchema).min(1),
  foreshadowing: z.array(z.string().min(1)).min(3),
});

const RequestSchema = z.object({
  projectId: z.string().uuid(),
  episodeNumber: z.number().int().positive(),
  rewrite: z.boolean().optional().default(false),
  rewriteInstruction: z.string().trim().min(1).optional(),
});

const DialogueLineSchema = z.object({
  character: z.string().min(1),
  emotion: z.string().min(1),
  text: z.string().min(1),
});

const EpisodeSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  sceneTitle: z.string().min(1),
  location: z.string().min(1),
  timeOfDay: z.string().min(1),
  sceneDescription: z.string().min(1),
  emotionalBeat: z.string().min(1),
  visualPrompt: z.string().min(1),
  dialogue: z.array(DialogueLineSchema).min(3),
});

const EpisodeScriptSchema = z.object({
  episodeNumber: z.number().int().positive(),
  title: z.string().min(1),
  logline: z.string().min(1),
  summary: z.string().min(1),
  scenes: z.array(EpisodeSceneSchema).min(4).max(8),
});

const PersistedMetaSchema = z.object({
  projectId: z.string().uuid(),
  episodeNumber: z.number().int().positive(),
  version: z.number().int().positive(),
  status: z.string().min(1),
});

const ResponseSchema = z.object({
  success: z.literal(true),
  episode: EpisodeScriptSchema,
  persisted: PersistedMetaSchema,
});

type Input = z.infer<typeof RequestSchema>;
type EpisodeScript = z.infer<typeof EpisodeScriptSchema>;
type PromptInput = Input & { seasonSpec: z.infer<typeof SeasonSpecSchema> };

// ========================
// Prompt Builder
// ========================

function getPacingGuidance(total: 3 | 6 | 9, ep: number): string {
  if (total === 3) {
    if (ep === 1) return "本集负责建置世界、建立人物关系、抛出主钩子与主冲突。";
    if (ep === 2) return "本集负责升级对抗、制造误会或反转、让主角陷入更被动局面。";
    return "本集负责高潮爆发、真相揭示、情感清算与结局兑现。";
  }
  if (total === 6) {
    if (ep <= 2) return "本集属于前段，负责设定、欲望建立、初次交锋与钩子抛出。";
    if (ep <= 4) return "本集属于中段，负责冲突升级、关系撕裂、秘密逼近或阶段性反杀。";
    return "本集属于后段，负责高潮推进、真相浮现、命运决断与结局收束。";
  }
  if (ep <= 3) return "本集属于前段，负责建置、人物欲望、初始冲突与连续钩子。";
  if (ep <= 6) return "本集属于中段，负责层层升级、反转、情绪撕裂与局势恶化。";
  return "本集属于后段，负责真相逼近、高潮连发、关系清算与结局兑现。";
}

function buildPrompt(input: PromptInput): string {
  const { seasonSpec: s, episodeNumber: ep, rewrite, rewriteInstruction } =
    input;

  const chars = s.characters
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}｜${c.role}｜${c.personality}｜目标:${c.goal}`
    )
    .join("\n");

  const foreshadowing = s.foreshadowing
    .map((f, i) => `${i + 1}. ${f}`)
    .join("\n");

  const rewriteBlock = rewrite
    ? `\n这是单集重写任务。\n重写要求：${rewriteInstruction ?? "提升戏剧张力、对白真实感与镜头可拍性。"}\n`
    : "";

  return `你是资深短剧编剧，负责生成"单集完整分场剧本"。

只生成第 ${ep} 集。不输出其他集。不输出解释文字。只输出 JSON。

【全局信息】
标题：${s.title}
整体logline：${s.logline}
世界观：${s.world}
基调：${s.tone}
核心冲突：${s.coreConflict}
总集数：${s.totalEpisodes} | 当前集数：${ep}

【三幕结构】
建置：${s.threeAct.setup}
对抗：${s.threeAct.confrontation}
结局：${s.threeAct.resolution}

【角色列表】
${chars}

【伏笔布局】
${foreshadowing}

【当前集节奏要求】
${getPacingGuidance(s.totalEpisodes, ep)}
${rewriteBlock}
【硬性要求】
1. 每集4-8场
2. 每场至少3句对白
3. 对白必须有人味：短句、破碎句、停顿、打断、欲言又止
4. 不要全是完整书面句
5. 每场必须推进：剧情/关系/风险/秘密/伏笔，至少一项
6. visualPrompt必须具体可拍，不要抽象词
7. 角色名必须来自角色列表
8. 结尾留悬念或爆点

【输出JSON格式】
{"episodeNumber":${ep},"title":"...","logline":"...","summary":"100-250字摘要","scenes":[{"sceneNumber":1,"sceneTitle":"...","location":"...","timeOfDay":"...","sceneDescription":"...","emotionalBeat":"...","visualPrompt":"...","dialogue":[{"character":"...","emotion":"...","text":"..."}]}]}`;
}

// ========================
// DB Helpers
// ========================

async function getExistingVersion(
  projectId: string,
  episodeNumber: number
): Promise<number> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("script_episodes")
    .select("version")
    .eq("project_id", projectId)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  const row = data as { version?: number } | null;
  return row?.version ?? 0;
}

async function upsertEpisode(params: {
  projectId: string;
  totalEpisodes: 3 | 6 | 9;
  episode: EpisodeScript;
  rewriteInstruction?: string;
  version: number;
}) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("script_episodes")
    .upsert(
      {
        project_id: params.projectId,
        episode_number: params.episode.episodeNumber,
        total_episodes: params.totalEpisodes,
        title: params.episode.title,
        logline: params.episode.logline,
        summary: params.episode.summary,
        scenes: params.episode.scenes,
        status: "draft",
        version: params.version,
        model: "claude-sonnet-4-20250514",
        rewrite_instruction: params.rewriteInstruction ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,episode_number" }
    )
    .select("project_id, episode_number, version, status")
    .single();

  if (error) throw new Error(`DB upsert failed: ${error.message}`);

  const row = data as {
    project_id: string;
    episode_number: number;
    version: number;
    status: string;
  };

  return {
    projectId: row.project_id,
    episodeNumber: row.episode_number,
    version: row.version,
    status: row.status,
  };
}

async function generateSceneVideos(params: {
  projectId: string;
  episode: EpisodeScript;
  characterImages: Record<string, string>;
}) {
  const supabase = createServerSupabaseClient();

  for (let i = 0; i < params.episode.scenes.length; i++) {
    const scene = params.episode.scenes[i];
    const sceneIndex = i + 1;

    try {
      // 检查是否已有此场景的任务
      const { data: existingTask } = await supabase
        .from("kling_tasks")
        .select("id, status")
        .eq("project_id", params.projectId)
        .eq("scene_index", sceneIndex)
        .maybeSingle();

      if (existingTask) {
        console.log(`Scene ${sceneIndex} already has task: ${existingTask.status}`);
        continue;
      }

      // 构建视频生成提示词
      const prompt = `${scene.visualPrompt}\n\n${scene.sceneDescription}`;

      // 收集角色参考图
      const referenceImageUrls: string[] = [];
      for (const dialogue of scene.dialogue) {
        const characterName = dialogue.character;
        const imageUrl = params.characterImages[characterName];
        if (imageUrl && !referenceImageUrls.includes(imageUrl)) {
          referenceImageUrls.push(imageUrl);
        }
      }

      // 如果没有角色图片，使用默认图片或跳过
      if (referenceImageUrls.length === 0) {
        console.log(`Scene ${sceneIndex}: No character images found, skipping video generation`);
        continue;
      }

      // 调用 Kling API
      console.log(`Scene ${sceneIndex}: Submitting video task to Kling API`);
      const { taskId } = await submitKlingVideoTask({
        prompt,
        referenceImageUrls,
        duration: 5,
      });

      // 创建 kling_tasks 记录
      const { error: insertError } = await supabase
        .from("kling_tasks")
        .insert({
          task_id: taskId,
          project_id: params.projectId,
          scene_index: sceneIndex,
          status: "processing",
        });

      if (insertError) {
        console.error(`Failed to create kling_task for scene ${sceneIndex}:`, insertError);
      } else {
        console.log(`Scene ${sceneIndex}: Created kling_task with task_id ${taskId}`);
      }

    } catch (error) {
      console.error(`Scene ${sceneIndex}: Failed to generate video:`, error);
      // 记录失败状态
      const { error: insertError } = await supabase
        .from("kling_tasks")
        .insert({
          project_id: params.projectId,
          scene_index: sceneIndex,
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
        });

      if (insertError) {
        console.error(`Failed to record error for scene ${sceneIndex}:`, insertError);
      }
    }
  }
}

// ========================
// Route Handler
// ========================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const input = RequestSchema.parse(body);

    const supabase = createServerSupabaseClient();
    const { data: projectRow, error: projectError } = await supabase
      .from("projects")
      .select("script_raw")
      .eq("id", input.projectId)
      .single();

    if (projectError || !projectRow) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const rawScript = (projectRow as { script_raw?: string | null }).script_raw ?? null;
    if (!rawScript) {
      return NextResponse.json(
        { error: "Project script_raw is empty. Please regenerate blueprint first." },
        { status: 400 }
      );
    }

    let scriptRaw: Record<string, unknown>;
    try {
      scriptRaw = JSON.parse(rawScript) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid project script_raw JSON" }, { status: 400 });
    }

    const structure =
      typeof scriptRaw.structure === "object" && scriptRaw.structure !== null
        ? (scriptRaw.structure as Record<string, unknown>)
        : {};

    const seasonSpec = {
      idea: scriptRaw.idea,
      direction: scriptRaw.selectedDirection,
      expandedStory: scriptRaw.expandedStory,
      totalEpisodes: scriptRaw.totalEpisodes,
      threeAct: structure.threeAct,
      characters: structure.characters,
      episodes: structure.episodes,
      foreshadowing: structure.foreshadowing,
    };

    const expandedStory =
      typeof seasonSpec.expandedStory === "object" && seasonSpec.expandedStory !== null
        ? (seasonSpec.expandedStory as Record<string, unknown>)
        : {};
    const promptSeasonSpec = SeasonSpecSchema.parse({
      title: expandedStory.title,
      logline: expandedStory.logline,
      world: expandedStory.world,
      tone: expandedStory.tone,
      coreConflict: expandedStory.coreConflict,
      totalEpisodes: seasonSpec.totalEpisodes,
      threeAct: seasonSpec.threeAct,
      characters: seasonSpec.characters,
      foreshadowing: seasonSpec.foreshadowing,
    });

    if (input.episodeNumber > promptSeasonSpec.totalEpisodes) {
      return NextResponse.json(
        {
          error: `episodeNumber ${input.episodeNumber} exceeds totalEpisodes ${promptSeasonSpec.totalEpisodes}`,
        },
        { status: 400 }
      );
    }

    const existingVersion = await getExistingVersion(
      input.projectId,
      input.episodeNumber
    );
    const nextVersion = existingVersion + 1;

    const prompt = buildPrompt({ ...input, seasonSpec: promptSeasonSpec });
    const raw = await callClaudeForScript(prompt);
    const episode = EpisodeScriptSchema.parse(safeParseJSON(raw));

    if (episode.episodeNumber !== input.episodeNumber) {
      return NextResponse.json(
        {
          error: `Model returned episode ${episode.episodeNumber}, expected ${input.episodeNumber}`,
        },
        { status: 500 }
      );
    }

    const persisted = await upsertEpisode({
      projectId: input.projectId,
      totalEpisodes: promptSeasonSpec.totalEpisodes,
      episode,
      rewriteInstruction: input.rewriteInstruction,
      version: nextVersion,
    });

    // 获取项目角色图片
    const { data: characterImagesData, error: imagesError } = await supabase
      .from("projects")
      .select("character_images")
      .eq("id", input.projectId)
      .single();

    let characterImages: Record<string, string> = {};
    if (!imagesError && characterImagesData?.character_images) {
      try {
        characterImages = JSON.parse(characterImagesData.character_images as string);
      } catch (e) {
        console.warn("Failed to parse character_images:", e);
      }
    }

    // 为每个场景生成视频任务
    try {
      await generateSceneVideos({
        projectId: input.projectId,
        episode,
        characterImages,
      });
    } catch (videoError) {
      console.error("Video generation failed:", videoError);
      // 不阻止剧本生成的成功响应，但记录错误
    }

    const response = ResponseSchema.parse({ success: true, episode, persisted });
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
