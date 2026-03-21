"use server";

import Anthropic from "@anthropic-ai/sdk";
import { parseScript } from "@/lib/narrative-engine/parser";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import { NARRATIVE_TRANSLATOR_PROMPT } from "@/prompts/nel-sentinel";
import {
  KLING_VIDEO_ASPECT_RATIO,
  stripHardcodedAspectRatioFromPrompt,
} from "@/lib/kling-video";
import { requireProjectId } from "@/lib/project-id";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** PiAPI expects lowercase `x-api-key` (duplicate with `X-API-Key` breaks some runtimes). */
const piapiHeaders = (key: string) => ({
  "Content-Type": "application/json",
  "x-api-key": key,
});

const piapiGetHeaders = (key: string) => ({ "x-api-key": key });

export async function analyzeScriptAction(input: {
  projectId: string;
  scriptText: string;
}): Promise<ActionResult<{ storyMemoryId: string }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const analysis = await parseScript(input.scriptText);
    const supabase = createClient();
    const analysisObj = analysis as Record<string, unknown>;

    const getString = (v: unknown): string =>
      typeof v === "string" ? v : "";

    const getArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

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
          model_used: "claude-sonnet-4-20250514",
        },
        { onConflict: "project_id" },
      )
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, data: { storyMemoryId: data.id as string } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : JSON.stringify(e) };
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

type KlingTaskItem = {
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

function findFirstUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    const m = value.match(/https?:\/\/[^\s"']+/i);
    return m ? m[0] : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findFirstUrl(v);
      if (found) return found;
    }
  }
  return undefined;
}

function extractVideoUrlFromPiOutput(data: Record<string, unknown>): string | undefined {
  const nested =
    data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null;
  const output =
    nested && nested.output && typeof nested.output === "object"
      ? (nested.output as Record<string, unknown>)
      : null;

  if (!output) return undefined;

  // Common shapes
  const outputObj = output as Record<string, unknown>;
  const videoObj =
    outputObj.video && typeof outputObj.video === "object"
      ? (outputObj.video as Record<string, unknown>)
      : null;

  const videoUrlFields = [
    outputObj.video_url,
    outputObj.videoUrl,
    outputObj.url,
    videoObj ? videoObj.url : undefined,
  ];
  for (const f of videoUrlFields) {
    if (typeof f === "string" && f.startsWith("http")) return f;
  }

  const works =
    output.works && Array.isArray(output.works) ? (output.works as unknown[]) : null;
  if (works && works.length > 0) {
    // Try works[0].video.url
    const first = works[0];
    const videoField =
      first && typeof first === "object"
        ? (first as Record<string, unknown>).video
        : undefined;
    const urlCandidate =
      videoField && typeof videoField === "object" && typeof (videoField as Record<string, unknown>).url === "string"
        ? String((videoField as Record<string, unknown>).url)
        : undefined;
    if (urlCandidate) return urlCandidate;
  }

  // Fallback: search first URL anywhere in output
  return findFirstUrl(output);
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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
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
            `Characters JSON: ${JSON.stringify(characters)}`,
            `Prop registry JSON: ${JSON.stringify(propRegistry)}`,
            `Causal result frames JSON: ${JSON.stringify(causalResultFrames)}`,
            `Beats JSON: ${JSON.stringify(beats)}`,
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
    return { success: false, error: e instanceof Error ? e.message : JSON.stringify(e) };
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
      .from("characters")
      .select("name, appearance, reference_image_url")
      .eq("project_id", projectId);
    const characterRows = Array.isArray(projectCharacters)
      ? (projectCharacters as Record<string, unknown>[])
      : [];

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

      const payload = {
        model: "kling",
        task_type: "video_generation",
        input: {
          prompt: injectCharacterReferenceLocks(
            stripHardcodedAspectRatioFromPrompt(item.prompt),
            characterRows,
          ),
          aspect_ratio: KLING_VIDEO_ASPECT_RATIO,
          duration: 5,
        },
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
        const videoUrl = extractVideoUrlFromPiOutput(data);

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

