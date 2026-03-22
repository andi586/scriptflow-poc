"use server";

import Anthropic from "@anthropic-ai/sdk";
import { parseScript } from "@/lib/narrative-engine/parser";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import { NARRATIVE_TRANSLATOR_PROMPT } from "@/prompts/nel-sentinel";
import { STORY_IDEA_FORMATTER_PROMPT } from "@/prompts/story-idea-formatter";
import { normalizeShotFromClaude, type StoryboardShot } from "@/lib/story-idea-format";
import {
  KLING_VIDEO_ASPECT_RATIO,
  stripHardcodedAspectRatioFromPrompt,
} from "@/lib/kling-video";
import { buildKlingVideoGenerationInput } from "@/lib/kling-piapi-payload";
import { formatUnknownError } from "@/lib/format-error";
import {
  extractVideoUrlFromPiResponse,
  parseKlingVideoPollTerminal,
} from "@/lib/kling-piapi-output";
import { getKlingVideoStatusPollUrl } from "@/lib/kling-video-poll";
import { PROJECT_CAST_TABLE } from "@/lib/project-cast-table";
import { requireProjectId } from "@/lib/project-id";

export type StoryMemorySummary = {
  seriesTitle: string;
  episodeTitle: string;
  narrativeArc: string;
  tone: string;
  visualStyle: string;
  beatCount: number;
  characterCount: number;
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function formatStoryIdeaAction(input: {
  idea: string;
}): Promise<ActionResult<{ shots: StoryboardShot[] }>> {
  try {
    const idea = (input.idea ?? "").trim();
    if (idea.length < 8) {
      return { success: false, error: "Story idea is too short." };
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: STORY_IDEA_FORMATTER_PROMPT,
      messages: [
        {
          role: "user",
          content: idea,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("Claude returned no text");
    }

    let jsonText = textContent.text.trim();
    jsonText = jsonText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed: unknown = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      throw new Error("Claude did not return a JSON array");
    }
    if (parsed.length !== 9) {
      throw new Error(`Expected exactly 9 shots, got ${parsed.length}`);
    }

    const shots = parsed.map((item, idx) => normalizeShotFromClaude(item, idx));
    return { success: true, data: { shots } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

/** PiAPI expects lowercase `x-api-key` (duplicate with `X-API-Key` breaks some runtimes). */
const piapiHeaders = (key: string) => ({
  "Content-Type": "application/json",
  "x-api-key": key,
});

const piapiGetHeaders = (key: string) => ({ "x-api-key": key });

export async function analyzeScriptAction(input: {
  projectId: string;
  scriptText: string;
  /**
   * `lazy`：精简 NEL 提示 + 更低 max_tokens + 默认 Haiku（`NEL_LAZY_MODEL` 可改），用于一键懒人模式降超时风险。
   * `full`：原版 Sentinel + Sonnet（Pro 模式 / 默认）。
   */
  nelProfile?: "full" | "lazy";
}): Promise<ActionResult<{ storyMemoryId: string; summary: StoryMemorySummary }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const nelProfile = input.nelProfile ?? "full";
    const analysis = await parseScript(input.scriptText, {
      profile: nelProfile,
    });
    const supabase = createClient();
    const analysisObj = analysis as Record<string, unknown>;

    const getString = (v: unknown): string =>
      typeof v === "string" ? v : "";

    const getArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

    const beats = getArray(analysisObj.beats);
    const characters = getArray(analysisObj.characters);

    const { data, error } = await supabase
      .from("story_memory")
      .upsert(
        {
          project_id: projectId,
          // story_memory has NOT NULL columns; if Claude omits fields,
          // persist safe defaults to avoid DB constraint errors.
          narrative_arc:
            getString(
              analysisObj.narrative_arc ?? (analysisObj as Record<string, unknown>).narrativeArc,
            ),
          tone: getString(analysisObj.tone),
          visual_style: getString(analysisObj.visual_style),
          foreshadowing_map: getArray(analysisObj.foreshadowing_map),
          core_visual_symbols: getArray(analysisObj.core_visual_symbols),
          continuity_notes:
            getString(analysisObj.cross_episode_continuity_notes),
          prop_registry: getArray(analysisObj.prop_registry),
          causal_result_frames: getArray(analysisObj.causal_result_frames),
          raw_analysis: analysis,
          model_used:
            typeof analysisObj.model_used === "string" && analysisObj.model_used.trim()
              ? analysisObj.model_used.trim()
              : nelProfile === "lazy"
                ? (process.env.NEL_LAZY_MODEL?.trim() || "claude-3-5-haiku-20241022")
                : "claude-sonnet-4-20250514",
        },
        { onConflict: "project_id" },
      )
      .select("id")
      .single();

    if (error) throw error;

    const summary: StoryMemorySummary = {
      seriesTitle: getString(analysisObj.series_title),
      episodeTitle: getString(analysisObj.episode_title),
      narrativeArc: getString(
        analysisObj.narrative_arc ?? (analysisObj as Record<string, unknown>).narrativeArc,
      ),
      tone: getString(analysisObj.tone),
      visualStyle: getString(analysisObj.visual_style),
      beatCount: beats.length,
      characterCount: characters.length,
    };

    return {
      success: true,
      data: { storyMemoryId: data.id as string, summary },
    };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

export async function getStoryMemoryForProjectAction(input: {
  projectId: string;
}): Promise<ActionResult<{ storyMemoryId: string; summary: StoryMemorySummary }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("story_memory")
      .select("id, narrative_arc, tone, visual_style, raw_analysis")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return {
        success: false,
        error: "No story_memory for this project — run NEL analysis first.",
      };
    }

    const raw =
      data.raw_analysis && typeof data.raw_analysis === "object"
        ? (data.raw_analysis as Record<string, unknown>)
        : {};

    const beats = Array.isArray(raw.beats) ? raw.beats : [];
    const chars = Array.isArray(raw.characters) ? raw.characters : [];

    const summary: StoryMemorySummary = {
      seriesTitle: typeof raw.series_title === "string" ? raw.series_title : "",
      episodeTitle: typeof raw.episode_title === "string" ? raw.episode_title : "",
      narrativeArc: String(data.narrative_arc ?? ""),
      tone: String(data.tone ?? ""),
      visualStyle: String(data.visual_style ?? ""),
      beatCount: beats.length,
      characterCount: chars.length,
    };

    return {
      success: true,
      data: { storyMemoryId: data.id as string, summary },
    };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

type KlingPromptItem = {
  beat_number: number;
  prompt: string;
};

type PropRegistryItem = {
  name: string;
  position?: string;
  side?: string;
  color?: string;
  shape?: string;
  state?: string;
  appears_in_beats?: number[];
  locked_description_en?: string;
};

type CausalResultItem = {
  beat_number: number;
  cause_chain?: string;
  result_frame_en?: string;
};

export type KlingTaskItem = {
  beat_number: number;
  task_id: string;
  status: string;
  video_url?: string;
  error_message?: string;
};

function stripMarkdownFences(content: string): string {
  return content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

function normalizeBeats(rawAnalysis: Record<string, unknown>) {
  const beatsRaw = Array.isArray(rawAnalysis.beats) ? rawAnalysis.beats : [];
  return beatsRaw.map((b, idx) => {
    const o = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    const n = Number(o.beat_number ?? o.beatNumber ?? o.index ?? idx + 1);
    const beat_number = Number.isFinite(n) && n > 0 ? n : idx + 1;
    return { ...o, beat_number };
  });
}

function normalizePropRegistry(rawAnalysis: Record<string, unknown>): PropRegistryItem[] {
  const raw = Array.isArray(rawAnalysis.prop_registry) ? rawAnalysis.prop_registry : [];
  return raw
    .map((item) => {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const beats = Array.isArray(o.appears_in_beats)
        ? o.appears_in_beats.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [];
      return {
        name: String(o.name ?? "").trim(),
        position: typeof o.position === "string" ? o.position : undefined,
        side: typeof o.side === "string" ? o.side : undefined,
        color: typeof o.color === "string" ? o.color : undefined,
        shape: typeof o.shape === "string" ? o.shape : undefined,
        state: typeof o.state === "string" ? o.state : undefined,
        appears_in_beats: beats,
        locked_description_en:
          typeof o.locked_description_en === "string" ? o.locked_description_en : undefined,
      } satisfies PropRegistryItem;
    })
    .filter((x) => x.name.length > 0);
}

function normalizeCausalResultFrames(rawAnalysis: Record<string, unknown>): CausalResultItem[] {
  const raw = Array.isArray(rawAnalysis.causal_result_frames) ? rawAnalysis.causal_result_frames : [];
  return raw
    .map((item) => {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const beat = Number(o.beat_number ?? o.beat ?? 0);
      return {
        beat_number: Number.isFinite(beat) ? beat : 0,
        cause_chain: typeof o.cause_chain === "string" ? o.cause_chain : undefined,
        result_frame_en: typeof o.result_frame_en === "string" ? o.result_frame_en : undefined,
      };
    })
    .filter((x) => x.beat_number > 0 && (x.result_frame_en ?? "").length > 0);
}

function buildPropLockDescription(item: PropRegistryItem) {
  if (item.locked_description_en && item.locked_description_en.trim().length > 0) {
    return item.locked_description_en.trim();
  }
  const parts = [item.color, item.shape, item.state, item.name, item.side, item.position]
    .filter((x) => typeof x === "string" && x.trim().length > 0)
    .join(" ");
  return parts.trim();
}

function injectBeatLocks(
  prompt: string,
  beatNumber: number,
  props: PropRegistryItem[],
  causalFrames: CausalResultItem[],
) {
  const propLines = props
    .filter((p) => Array.isArray(p.appears_in_beats) && p.appears_in_beats.includes(beatNumber))
    .map((p) => buildPropLockDescription(p))
    .filter((x) => x.length > 0);
  const causalLines = causalFrames
    .filter((c) => c.beat_number === beatNumber)
    .map((c) => c.result_frame_en?.trim() ?? "")
    .filter((x) => x.length > 0);

  const suffix: string[] = [];
  if (propLines.length > 0) {
    suffix.push("Prop locks:");
    for (const line of propLines) suffix.push(`- ${line}`);
  }
  if (causalLines.length > 0) {
    suffix.push("Static result frame constraints (no process/action narration):");
    for (const line of causalLines) suffix.push(`- ${line}`);
  }
  if (suffix.length === 0) return prompt;
  return `${prompt.trim()}\n\n${suffix.join("\n")}`.trim();
}

/**
 * Shrink nested JSON sent to Claude for Kling prompt generation — large raw_analysis
 * increases latency and can push Vercel functions past their time limit.
 */
function compactForClaudePayload(value: unknown, maxStr = 1400, maxArrayLen = 64): unknown {
  if (typeof value === "string") {
    return value.length > maxStr ? `${value.slice(0, maxStr)}…[truncated]` : value;
  }
  if (Array.isArray(value)) {
    const slice = value.length > maxArrayLen ? value.slice(0, maxArrayLen) : value;
    return slice.map((x) => compactForClaudePayload(x, maxStr, maxArrayLen));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = compactForClaudePayload(v, maxStr, maxArrayLen);
    }
    return out;
  }
  return value;
}

function injectCharacterReferenceLocks(prompt: string, characters: Record<string, unknown>[]) {
  if (characters.length === 0) return prompt;
  const lines = characters
    .map((c) => {
      const name = typeof c.name === "string" ? c.name : "";
      const appearance = typeof c.appearance === "string" ? c.appearance : "";
      const ref = typeof c.reference_image_url === "string" ? c.reference_image_url : "";
      if (!name) return "";
      return `- ${name}: appearance lock = ${appearance || "locked by reference image"}; ref = ${ref}`;
    })
    .filter((x) => x.length > 0);
  if (lines.length === 0) return prompt;
  return `${prompt.trim()}\n\nCharacter appearance locks:\n${lines.join("\n")}`.trim();
}

export async function generateKlingPromptsAction(input: {
  projectId: string;
}): Promise<ActionResult<{ prompts: KlingPromptItem[] }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const { data: storyMemory, error } = await supabase
      .from("story_memory")
      .select("project_id, raw_analysis, visual_style, tone")
      .eq("project_id", projectId)
      .single();

    if (error || !storyMemory) {
      throw new Error("未找到该项目的 story_memory，请先完成 Step 1 Analyze Script。");
    }

    const rawAnalysis =
      storyMemory.raw_analysis && typeof storyMemory.raw_analysis === "object"
        ? (storyMemory.raw_analysis as Record<string, unknown>)
        : {};

    const beats = normalizeBeats(rawAnalysis);
    if (beats.length === 0) {
      throw new Error("story_memory 中没有 beats，无法生成提示词。");
    }

    const characters = Array.isArray(rawAnalysis.characters) ? rawAnalysis.characters : [];
    const propRegistry = normalizePropRegistry(rawAnalysis);
    const causalResultFrames = normalizeCausalResultFrames(rawAnalysis);

    const beatsPayload = compactForClaudePayload(beats) as unknown;
    const charactersPayload = compactForClaudePayload(characters) as unknown;
    const propsPayload = compactForClaudePayload(propRegistry) as unknown;
    const causalPayload = compactForClaudePayload(causalResultFrames) as unknown;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: NARRATIVE_TRANSLATOR_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            "请根据以下故事记忆，为每个场景（beat）生成 Kling 英文提示词。",
            "",
            "硬性格式要求：每个提示词必须包含并按顺序组织以下元素：",
            "1) Scene description",
            "2) Character appearance",
            "3) Camera movement",
            "4) Visual style",
            "",
            "不要在提示词文本里写画面比例或 9:16；比例由视频生成 API 的 aspect_ratio 参数单独传递。",
            "若该 beat 涉及关键道具，必须精确复现道具锁定描述（位置/左右手/颜色/形状/状态）。",
            "若该 beat 涉及动作因果链，禁止写动作过程，只写结果定格画面（state-after-causality）。",
            "",
            "输出必须是 JSON 数组，每项结构：",
            '{ "beat_number": number, "prompt": string }',
            "",
            `Tone: ${String(storyMemory.tone ?? "")}`,
            `Visual style: ${String(storyMemory.visual_style ?? "")}`,
            "",
            `Characters JSON: ${JSON.stringify(charactersPayload)}`,
            `Prop registry JSON: ${JSON.stringify(propsPayload)}`,
            `Causal result frames JSON: ${JSON.stringify(causalPayload)}`,
            `Beats JSON: ${JSON.stringify(beatsPayload)}`,
          ].join("\n"),
        },
      ],
    });

    const text = message.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    const cleaned = stripMarkdownFences(text);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Claude 返回格式错误：不是数组。");
    }

    const prompts = parsed
      .map((item) => {
        const obj = item as Record<string, unknown>;
        const beatNumber = Number(obj.beat_number);
        const prompt = typeof obj.prompt === "string" ? obj.prompt : "";
        const normalizedBeat = Number.isFinite(beatNumber) ? beatNumber : 0;
        return {
          beat_number: normalizedBeat,
          prompt: injectBeatLocks(prompt, normalizedBeat, propRegistry, causalResultFrames),
        };
      })
      .filter((item) => item.beat_number > 0 && item.prompt.length > 0);

    if (prompts.length === 0) {
      throw new Error("Claude 没有返回可用的提示词。");
    }

    return { success: true, data: { prompts } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

function getKlingConfig() {
  const base = process.env.KLING_API_BASE ?? "";
  const key = process.env.KLING_API_KEY ?? "";
  if (!base) throw new Error("Missing KLING_API_BASE");
  if (!key) throw new Error("Missing KLING_API_KEY");
  return { base, key };
}

export async function submitKlingTasksAction(input: {
  projectId: string;
  prompts: KlingPromptItem[];
}): Promise<ActionResult<{ tasks: KlingTaskItem[] }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    if (!Array.isArray(input.prompts) || input.prompts.length === 0) {
      throw new Error("No prompts provided. Please run Step 2 first.");
    }

    const supabase = createClient();
    const sceneIndices = input.prompts.map((p) => p.beat_number);
    const { data: projectCharacters } = await supabase
      .from(PROJECT_CAST_TABLE)
      .select("name, appearance, reference_image_url")
      .eq("project_id", projectId);
    const characterRows = Array.isArray(projectCharacters)
      ? (projectCharacters as Record<string, unknown>[])
      : [];

    const referenceImageUrls = characterRows
      .map((c) =>
        typeof c.reference_image_url === "string" ? c.reference_image_url.trim() : "",
      )
      .filter((u) => /^https:\/\//i.test(u));

    // 1) Check DB first: if this project+scene already has processing/success, reuse it.
    const { data: existingRows, error: existingError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id, status, video_url, error_message")
      .eq("project_id", projectId)
      .in("scene_index", sceneIndices)
      .in("status", ["processing", "success"]);

    if (existingError) throw existingError;

    const existingMap = new Map<
      number,
      {
        task_id: string;
        status: string;
        video_url?: string;
        error_message?: string;
      }
    >();

    if (Array.isArray(existingRows)) {
      for (const row of existingRows) {
        const r = row as Record<string, unknown>;
        const sceneIndex = Number(r.scene_index);
        const taskId = typeof r.task_id === "string" ? r.task_id : "";
        const status = typeof r.status === "string" ? r.status : "processing";
        if (!Number.isFinite(sceneIndex) || !taskId) continue;

        existingMap.set(sceneIndex, {
          task_id: taskId,
          status,
          video_url: typeof r.video_url === "string" ? r.video_url : undefined,
          error_message:
            typeof r.error_message === "string" ? r.error_message : undefined,
        });
      }
    }

    const { base, key } = getKlingConfig();

    // We'll insert missing scenes immediately after submitting to PiAPI.
    for (const item of input.prompts) {
      if (existingMap.has(item.beat_number)) continue;

      const finalPrompt = injectCharacterReferenceLocks(
        stripHardcodedAspectRatioFromPrompt(item.prompt),
        characterRows,
      );

      // PiAPI: multi-image refs for model "kling" + video_generation use Kling Elements
      // `input.elements`: [{ image_url } x 1–4], plus mode/version per docs.
      const input = buildKlingVideoGenerationInput({
        prompt: finalPrompt,
        aspectRatio: KLING_VIDEO_ASPECT_RATIO,
        duration: 5,
        referenceImageUrls,
      });

      const payload = {
        model: "kling",
        task_type: "video_generation",
        input,
      };

      const res = await fetch(`${base}/task`, {
        method: "POST",
        cache: "no-store",
        headers: piapiHeaders(key),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        // Insert failed placeholder so UI has something persistent (optional).
        await supabase.from("kling_tasks").insert({
          project_id: projectId,
          task_id: `failed_${item.beat_number}_${Date.now()}`,
          scene_index: item.beat_number,
          status: "failed",
          error_message: `Submit failed: ${res.status} ${text}`,
        });
        continue;
      }

      const data = (await res.json()) as Record<string, unknown>;
      const nested =
        data.data && typeof data.data === "object"
          ? (data.data as Record<string, unknown>)
          : null;
      const taskId = String(data.task_id ?? data.id ?? nested?.task_id ?? "");
      if (!taskId) {
        await supabase.from("kling_tasks").insert({
          project_id: projectId,
          task_id: `missing_${item.beat_number}_${Date.now()}`,
          scene_index: item.beat_number,
          status: "failed",
          error_message: "Submit response missing task_id",
        });
        continue;
      }

      // 3) Immediately persist task_id to kling_tasks.
      const { error: insertError } = await supabase.from("kling_tasks").insert({
        project_id: projectId,
        task_id: taskId,
        scene_index: item.beat_number,
        status: "processing",
        video_url: null,
        error_message: null,
      });
      if (insertError) throw insertError;

      existingMap.set(item.beat_number, {
        task_id: taskId,
        status: "processing",
      });
    }

    // 5) Return DB-backed tasks for scenes in this run.
    const { data: finalRows, error: finalError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id, status, video_url, error_message")
      .eq("project_id", projectId)
      .in("scene_index", sceneIndices)
      .order("created_at", { ascending: false });

    if (finalError) throw finalError;

    const finalMap = new Map<number, KlingTaskItem>();
    if (Array.isArray(finalRows)) {
      for (const row of finalRows) {
        const r = row as Record<string, unknown>;
        const sceneIndex = Number(r.scene_index);
        if (!Number.isFinite(sceneIndex)) continue;
        if (finalMap.has(sceneIndex)) continue;

        const taskId = typeof r.task_id === "string" ? r.task_id : "";
        const status = typeof r.status === "string" ? r.status : "processing";

        finalMap.set(sceneIndex, {
          beat_number: sceneIndex,
          task_id: taskId,
          status,
          video_url: typeof r.video_url === "string" ? r.video_url : undefined,
          error_message:
            typeof r.error_message === "string" ? r.error_message : undefined,
        });
      }
    }

    const tasks: KlingTaskItem[] = input.prompts.map((p) => {
      return (
        finalMap.get(p.beat_number) ?? {
          beat_number: p.beat_number,
          task_id: "",
          status: "processing",
        }
      );
    });

    return { success: true, data: { tasks } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : JSON.stringify(e) };
  }
}

export async function pollKlingTasksAction(input: {
  projectId: string;
  sceneIndices: number[];
}): Promise<ActionResult<{ tasks: KlingTaskItem[] }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    if (!Array.isArray(input.sceneIndices) || input.sceneIndices.length === 0) {
      throw new Error("sceneIndices is required.");
    }

    const supabase = createClient();
    const { base, key } = getKlingConfig();
    // 4) Poll from DB: this project's processing tasks only.
    const { data: processingRows, error: processingError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id")
      .eq("project_id", projectId)
      .eq("status", "processing")
      .in("scene_index", input.sceneIndices);

    if (processingError) throw processingError;

    if (Array.isArray(processingRows)) {
      for (const row of processingRows) {
        const r = row as Record<string, unknown>;
        const sceneIndex = Number(r.scene_index);
        const taskId = typeof r.task_id === "string" ? r.task_id : "";
        if (!Number.isFinite(sceneIndex) || !taskId) continue;

        const res = await fetch(`${base}/task/${taskId}`, {
          method: "GET",
          cache: "no-store",
          headers: piapiGetHeaders(key),
        });

        if (!res.ok) {
          const text = await res.text();
          await supabase
            .from("kling_tasks")
            .update({
              status: "failed",
              error_message: `Poll failed: ${res.status} ${text}`,
            })
            .eq("task_id", taskId);
          continue;
        }

        const data = (await res.json()) as Record<string, unknown>;
        const piNested =
          data.data && typeof data.data === "object" ? data.data : undefined;

        const piStatusRaw =
          piNested && typeof piNested === "object" && "status" in (piNested as Record<string, unknown>)
            ? (piNested as Record<string, unknown>).status
            : (data as Record<string, unknown>).status;

        const providerStatus = String(piStatusRaw ?? "").toLowerCase();
        const videoUrl = extractVideoUrlFromPiResponse(data);

        const normalized = providerStatus.replace(/[^a-z]/g, "");
        const hasVideo = typeof videoUrl === "string" && videoUrl.length > 0;
        const isFailed = normalized.includes("fail") || normalized.includes("error");
        const isSuccess =
          normalized.includes("success") ||
          normalized.includes("succeed") ||
          normalized.includes("complete") ||
          normalized.includes("completed") ||
          normalized.includes("done") ||
          hasVideo; // fallback: if PiAPI already returned a video url, treat as success

        if (isSuccess && !isFailed) {
          const { error: updateError } = await supabase
            .from("kling_tasks")
            .update({
              status: "success",
              video_url: videoUrl ?? null,
              error_message: null,
            })
            .eq("task_id", taskId);
          if (updateError) throw updateError;
        } else if (isFailed) {
          const piNestedObj =
            piNested && typeof piNested === "object" ? (piNested as Record<string, unknown>) : null;
          const outputObj =
            piNestedObj &&
            piNestedObj.output &&
            typeof piNestedObj.output === "object"
              ? (piNestedObj.output as Record<string, unknown>)
              : null;

          const errField = piNestedObj ? piNestedObj.error : undefined;
          const errFromPi =
            typeof errField === "string"
              ? errField
              : errField &&
                  typeof errField === "object" &&
                  typeof (errField as { message?: unknown }).message === "string"
                ? String((errField as { message: string }).message)
                : undefined;
          const errorMessage =
            errFromPi ??
            (outputObj && typeof outputObj.error === "string" ? outputObj.error : undefined) ??
            (typeof (data as Record<string, unknown>).error === "string"
              ? String((data as Record<string, unknown>).error)
              : "Kling task failed");
          const { error: updateError } = await supabase
            .from("kling_tasks")
            .update({
              status: "failed",
              error_message: errorMessage,
            })
            .eq("task_id", taskId);
          if (updateError) throw updateError;
        } else {
          // still processing; keep row as-is
        }
      }
    }

    // Return DB-backed tasks for UI
    const { data: finalRows, error: finalError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id, status, video_url, error_message")
      .eq("project_id", projectId)
      .in("scene_index", input.sceneIndices)
      .order("created_at", { ascending: false });

    if (finalError) throw finalError;

    const finalMap = new Map<number, KlingTaskItem>();
    if (Array.isArray(finalRows)) {
      for (const row of finalRows) {
        const rr = row as Record<string, unknown>;
        const sceneIndex = Number(rr.scene_index);
        if (!Number.isFinite(sceneIndex)) continue;
        if (finalMap.has(sceneIndex)) continue;

        const taskId = typeof rr.task_id === "string" ? rr.task_id : "";
        const status = typeof rr.status === "string" ? rr.status : "processing";

        finalMap.set(sceneIndex, {
          beat_number: sceneIndex,
          task_id: taskId,
          status,
          video_url: typeof rr.video_url === "string" ? rr.video_url : undefined,
          error_message:
            typeof rr.error_message === "string" ? rr.error_message : undefined,
        });
      }
    }

    const tasks: KlingTaskItem[] = input.sceneIndices
      .slice()
      .sort((a, b) => a - b)
      .map((idx) => finalMap.get(idx) ?? { beat_number: idx, task_id: "", status: "processing" });

    return { success: true, data: { tasks } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : JSON.stringify(e) };
  }
}

async function fetchKlingTasksForProjectAggregated(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
): Promise<KlingTaskItem[]> {
  const { data: rows, error } = await supabase
    .from("kling_tasks")
    .select("scene_index, task_id, status, video_url, error_message")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const byScene = new Map<number, KlingTaskItem>();
  for (const row of rows ?? []) {
    const r = row as Record<string, unknown>;
    const si = Number(r.scene_index);
    if (!Number.isFinite(si) || byScene.has(si)) continue;
    byScene.set(si, {
      beat_number: si,
      task_id: typeof r.task_id === "string" ? r.task_id : "",
      status: typeof r.status === "string" ? r.status : "processing",
      video_url: typeof r.video_url === "string" ? r.video_url : undefined,
      error_message: typeof r.error_message === "string" ? r.error_message : undefined,
    });
  }
  return [...byScene.keys()].sort((a, b) => a - b).map((b) => byScene.get(b)!);
}

/**
 * Aligns UI rows to the caller's task_id order (same length as input).
 * If the same task_id appears in multiple scenes, each list position still gets a row;
 * PiAPI id is always the real `task_id` from DB (latest row by created_at when duplicates exist).
 */
async function fetchKlingTasksAlignedToOrderedTaskIds(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  orderedTaskIds: string[],
): Promise<KlingTaskItem[]> {
  const trimmed = orderedTaskIds.map((t) => t.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];

  const unique = [...new Set(trimmed)];
  const { data: rows, error } = await supabase
    .from("kling_tasks")
    .select("scene_index, task_id, status, video_url, error_message, created_at")
    .eq("project_id", projectId)
    .in("task_id", unique);

  if (error) throw error;

  /** Latest row per task_id (Supabase row order is not guaranteed). */
  const bestByTaskId = new Map<string, KlingTaskItem>();
  const candidates = [...(rows ?? [])] as Record<string, unknown>[];
  candidates.sort((a, b) => {
    const ca = String(a.created_at ?? "");
    const cb = String(b.created_at ?? "");
    return cb.localeCompare(ca);
  });
  for (const r of candidates) {
    const tid = typeof r.task_id === "string" ? r.task_id.trim() : "";
    if (!tid || bestByTaskId.has(tid)) continue;
    const si = Number(r.scene_index);
    bestByTaskId.set(tid, {
      beat_number: Number.isFinite(si) ? si : 0,
      task_id: tid,
      status: typeof r.status === "string" ? r.status : "processing",
      video_url: typeof r.video_url === "string" ? r.video_url : undefined,
      error_message:
        typeof r.error_message === "string" ? r.error_message : undefined,
    });
  }

  return trimmed.map((tid, idx) => {
    const t = bestByTaskId.get(tid);
    if (t) {
      const beat = t.beat_number > 0 ? t.beat_number : idx + 1;
      return { ...t, beat_number: beat };
    }
    return {
      beat_number: idx + 1,
      task_id: tid,
      status: "processing",
    };
  });
}

/** All PiAPI task_ids for a project, one per scene_index (latest row), sorted by scene. */
export async function listKlingTaskIdsForSessionAction(input: {
  sessionId: string;
}): Promise<ActionResult<{ taskIds: string[] }>> {
  try {
    const projectId = requireProjectId(input.sessionId);
    const supabase = createClient();
    const { data: rows, error } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const byScene = new Map<number, string>();
    for (const row of rows ?? []) {
      const r = row as Record<string, unknown>;
      const si = Number(r.scene_index);
      const tid = typeof r.task_id === "string" ? r.task_id.trim() : "";
      if (!Number.isFinite(si) || !tid) continue;
      if (byScene.has(si)) continue;
      byScene.set(si, tid);
    }

    const taskIds = [...byScene.keys()]
      .sort((a, b) => a - b)
      .map((s) => byScene.get(s)!);

    return { success: true, data: { taskIds } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

/**
 * Poll PiAPI Kling video status for a fixed list of task_ids under a session (project).
 * pollErrors keys are task_id strings.
 */
export async function pollSessionKlingVideoStatusAction(input: {
  sessionId: string;
  taskIds: string[];
}): Promise<ActionResult<{ tasks: KlingTaskItem[]; pollErrors: Record<string, string> }>> {
  try {
    const projectId = requireProjectId(input.sessionId);
    /** Preserve order & length — do NOT dedupe (duplicate PiAPI ids would collapse scenes). */
    const taskIdsInOrder = input.taskIds.map((t) => t.trim()).filter(Boolean);
    if (taskIdsInOrder.length === 0) {
      return { success: true, data: { tasks: [], pollErrors: {} } };
    }

    const supabase = createClient();
    const { key } = getKlingConfig();

    const snapshot = await fetchKlingTasksAlignedToOrderedTaskIds(
      supabase,
      projectId,
      taskIdsInOrder,
    );
    const pollErrors: Record<string, string> = {};

    const polledPiTaskIds = new Set<string>();
    for (const t of snapshot) {
      const tid = t.task_id.trim();
      if (!tid || polledPiTaskIds.has(tid)) continue;
      polledPiTaskIds.add(tid);
      try {
        const err = await pollOneKlingTaskFromVideoApi(
          supabase,
          projectId,
          key,
          t.beat_number,
          tid,
          t.status,
        );
        if (err.pollError) pollErrors[tid] = err.pollError;
      } catch (e) {
        pollErrors[tid] = formatUnknownError(e);
      }
    }

    const tasks = await fetchKlingTasksAlignedToOrderedTaskIds(
      supabase,
      projectId,
      taskIdsInOrder,
    );
    return { success: true, data: { tasks, pollErrors } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

/**
 * Fresh PiAPI video URL for playback/download. DB `video_url` expires; always use this before play/zip.
 * GET KLING_VIDEO_STATUS_BASE/video/{task_id} → extractVideoUrlFromPiResponse (works[0].resource.resource).
 */
export async function resolveKlingVideoPlaybackUrlAction(input: {
  sessionId: string;
  taskId: string;
}): Promise<ActionResult<{ videoUrl: string }>> {
  try {
    const projectId = requireProjectId(input.sessionId);
    const taskId = input.taskId.trim();
    if (!taskId || taskId.startsWith("failed_") || taskId.startsWith("missing_")) {
      return { success: false, error: "Invalid task id." };
    }

    const supabase = createClient();
    const { data: rows, error: rowErr } = await supabase
      .from("kling_tasks")
      .select("task_id")
      .eq("project_id", projectId)
      .eq("task_id", taskId)
      .limit(1);

    if (rowErr) throw rowErr;
    if (!rows?.length) {
      return { success: false, error: "Task not found for this session." };
    }

    const { key } = getKlingConfig();
    const pollUrl = getKlingVideoStatusPollUrl(taskId);
    const res = await fetch(pollUrl, {
      method: "GET",
      cache: "no-store",
      headers: piapiGetHeaders(key),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `PiAPI ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const videoUrl = extractVideoUrlFromPiResponse(data);
    if (!videoUrl?.trim()) {
      return {
        success: false,
        error: "PiAPI did not return a playable video URL yet.",
      };
    }

    const trimmed = videoUrl.trim();
    const { error: cacheErr } = await supabase
      .from("kling_tasks")
      .update({ video_url: trimmed })
      .eq("project_id", projectId)
      .eq("task_id", taskId);
    if (cacheErr) {
      // Playback URL is still valid; DB cache update is best-effort.
      console.warn("[resolveKlingVideoPlaybackUrl] cache update failed:", cacheErr.message);
    }

    return { success: true, data: { videoUrl: trimmed } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

export async function pollSingleSessionKlingVideoTaskAction(input: {
  sessionId: string;
  taskId: string;
  taskIds: string[];
}): Promise<ActionResult<{ tasks: KlingTaskItem[]; pollError?: string }>> {
  try {
    const projectId = requireProjectId(input.sessionId);
    const taskId = input.taskId.trim();
    const ordered = input.taskIds.map((t) => t.trim()).filter(Boolean);
    if (!taskId || ordered.length === 0) {
      return { success: true, data: { tasks: [] } };
    }

    const supabase = createClient();
    const { key } = getKlingConfig();

    const snapshot = await fetchKlingTasksAlignedToOrderedTaskIds(
      supabase,
      projectId,
      ordered,
    );
    const row = snapshot.find((t) => t.task_id.trim() === taskId);
    let pollError: string | undefined;
    if (row) {
      try {
        const err = await pollOneKlingTaskFromVideoApi(
          supabase,
          projectId,
          key,
          row.beat_number,
          row.task_id.trim(),
          row.status,
          { includeFailed: true },
        );
        pollError = err.pollError;
      } catch (e) {
        pollError = formatUnknownError(e);
      }
    }

    const tasks = await fetchKlingTasksAlignedToOrderedTaskIds(supabase, projectId, ordered);
    return { success: true, data: { tasks, pollError } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

async function pollOneKlingTaskFromVideoApi(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  key: string,
  sceneIndex: number,
  taskId: string,
  currentStatus: string,
  options?: { includeFailed?: boolean },
): Promise<{ pollError?: string }> {
  if (currentStatus === "success") return {};
  if (currentStatus === "failed" && !options?.includeFailed) return {};
  if (!taskId || taskId.startsWith("failed_") || taskId.startsWith("missing_")) return {};

  const pollUrl = getKlingVideoStatusPollUrl(taskId);
  const res = await fetch(pollUrl, {
    method: "GET",
    cache: "no-store",
    headers: piapiGetHeaders(key),
  });

  if (!res.ok) {
    const text = await res.text();
    return { pollError: `HTTP ${res.status} ${text.slice(0, 200)}` };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const videoUrl = extractVideoUrlFromPiResponse(data);
  const terminal = parseKlingVideoPollTerminal(data, videoUrl);

  if (terminal === "success" && videoUrl) {
    const { error: upErr } = await supabase
      .from("kling_tasks")
      .update({
        status: "success",
        video_url: videoUrl,
        error_message: null,
      })
      .eq("project_id", projectId)
      .eq("task_id", taskId);
    if (upErr) throw upErr;
    return {};
  }

  if (terminal === "failed") {
    const msg =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      "Kling task failed";
    const { error: upErr } = await supabase
      .from("kling_tasks")
      .update({
        status: "failed",
        error_message: String(msg).slice(0, 2000),
      })
      .eq("project_id", projectId)
      .eq("task_id", taskId);
    if (upErr) throw upErr;
  }

  return {};
}

/**
 * Lazy-mode polling: GET Kling v1 video status per processing task; transient HTTP errors
 * do not mark DB failed (only returned in pollErrors).
 */
export async function pollProjectKlingVideoStatusAction(input: {
  projectId: string;
}): Promise<ActionResult<{ tasks: KlingTaskItem[]; pollErrors: Record<string, string> }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const { key } = getKlingConfig();

    const tasksSnapshot = await fetchKlingTasksForProjectAggregated(supabase, projectId);
    const pollErrors: Record<string, string> = {};

    for (const t of tasksSnapshot) {
      try {
        const err = await pollOneKlingTaskFromVideoApi(
          supabase,
          projectId,
          key,
          t.beat_number,
          t.task_id,
          t.status,
        );
        if (err.pollError) pollErrors[String(t.beat_number)] = err.pollError;
      } catch (e) {
        pollErrors[String(t.beat_number)] = formatUnknownError(e);
      }
    }

    const tasks = await fetchKlingTasksForProjectAggregated(supabase, projectId);
    return { success: true, data: { tasks, pollErrors } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

export async function pollSingleKlingVideoTaskAction(input: {
  projectId: string;
  sceneIndex: number;
}): Promise<ActionResult<{ tasks: KlingTaskItem[]; pollError?: string }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const { key } = getKlingConfig();
    const sceneIndex = input.sceneIndex;

    const { data: rowList, error } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id, status, video_url, error_message")
      .eq("project_id", projectId)
      .eq("scene_index", sceneIndex)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    const row = rowList?.[0] as Record<string, unknown> | undefined;

    let pollError: string | undefined;
    if (row) {
      const taskId = typeof row.task_id === "string" ? row.task_id : "";
      const status = typeof row.status === "string" ? row.status : "processing";
      try {
        const err = await pollOneKlingTaskFromVideoApi(
          supabase,
          projectId,
          key,
          sceneIndex,
          taskId,
          status,
          { includeFailed: true },
        );
        pollError = err.pollError;
      } catch (e) {
        pollError = formatUnknownError(e);
      }
    }

    const tasks = await fetchKlingTasksForProjectAggregated(supabase, projectId);
    return { success: true, data: { tasks, pollError } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}

