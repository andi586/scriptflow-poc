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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeScriptAction(input: {
  projectId: string;
  scriptText: string;
}): Promise<ActionResult<{ storyMemoryId: string }>> {
  try {
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
          project_id: input.projectId,
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

export async function generateKlingPromptsAction(input: {
  projectId: string;
}): Promise<ActionResult<{ prompts: KlingPromptItem[] }>> {
  try {
    const supabase = createClient();
    const { data: storyMemory, error } = await supabase
      .from("story_memory")
      .select("project_id, raw_analysis, visual_style, tone")
      .eq("project_id", input.projectId)
      .single();

    if (error || !storyMemory) {
      throw new Error("未找到该项目的 story_memory，请先完成 Step 1 Analyze Script。");
    }

    const rawAnalysis =
      storyMemory.raw_analysis && typeof storyMemory.raw_analysis === "object"
        ? (storyMemory.raw_analysis as Record<string, unknown>)
        : {};

    const beats = Array.isArray(rawAnalysis.beats) ? rawAnalysis.beats : [];
    if (beats.length === 0) {
      throw new Error("story_memory 中没有 beats，无法生成提示词。");
    }

    const characters = Array.isArray(rawAnalysis.characters) ? rawAnalysis.characters : [];

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
            "",
            "输出必须是 JSON 数组，每项结构：",
            '{ "beat_number": number, "prompt": string }',
            "",
            `Tone: ${String(storyMemory.tone ?? "")}`,
            `Visual style: ${String(storyMemory.visual_style ?? "")}`,
            "",
            `Characters JSON: ${JSON.stringify(characters)}`,
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
        return { beat_number: Number.isFinite(beatNumber) ? beatNumber : 0, prompt };
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
    if (!Array.isArray(input.prompts) || input.prompts.length === 0) {
      throw new Error("No prompts provided. Please run Step 2 first.");
    }

    const supabase = createClient();
    const sceneIndices = input.prompts.map((p) => p.beat_number);

    // 1) Check DB first: if a scene already has processing/success, reuse it.
    const { data: existingRows, error: existingError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id, status, video_url, error_message")
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
          prompt: stripHardcodedAspectRatioFromPrompt(item.prompt),
          aspect_ratio: KLING_VIDEO_ASPECT_RATIO,
          duration: 5,
        },
      };

      const res = await fetch(`${base}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        // Insert failed placeholder so UI has something persistent (optional).
        await supabase.from("kling_tasks").insert({
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
          task_id: `missing_${item.beat_number}_${Date.now()}`,
          scene_index: item.beat_number,
          status: "failed",
          error_message: "Submit response missing task_id",
        });
        continue;
      }

      // 3) Immediately persist task_id to kling_tasks.
      const { error: insertError } = await supabase.from("kling_tasks").insert({
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
      .in("scene_index", sceneIndices);

    if (finalError) throw finalError;

    const finalMap = new Map<number, KlingTaskItem>();
    if (Array.isArray(finalRows)) {
      for (const row of finalRows) {
        const r = row as Record<string, unknown>;
        const sceneIndex = Number(r.scene_index);
        if (!Number.isFinite(sceneIndex)) continue;

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
  sceneIndices: number[];
}): Promise<ActionResult<{ tasks: KlingTaskItem[] }>> {
  try {
    if (!Array.isArray(input.sceneIndices) || input.sceneIndices.length === 0) {
      throw new Error("sceneIndices is required.");
    }

    const supabase = createClient();
    const { base, key } = getKlingConfig();
    // 4) Poll from DB: processing tasks only.
    const { data: processingRows, error: processingError } = await supabase
      .from("kling_tasks")
      .select("scene_index, task_id")
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
          headers: { "X-API-Key": key },
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
        // Debug: inspect PiAPI actual status values for completed tasks.
        const piNested =
          data.data && typeof data.data === "object" ? data.data : undefined;
        console.log("PiAPI task poll raw response:", {
          taskId,
          status_top: (data as Record<string, unknown>).status,
          status_nested:
            piNested && typeof piNested === "object" && "status" in (piNested as Record<string, unknown>)
              ? (piNested as Record<string, unknown>).status
              : undefined,
          raw: data,
        });

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

          const errorMessage =
            piNestedObj && typeof piNestedObj.error === "string"
              ? piNestedObj.error
              : outputObj && typeof outputObj.error === "string"
                ? outputObj.error
                : typeof (data as Record<string, unknown>).error === "string"
                  ? String((data as Record<string, unknown>).error)
                  : "Kling task failed";
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
      .in("scene_index", input.sceneIndices);

    if (finalError) throw finalError;

    const finalMap = new Map<number, KlingTaskItem>();
    if (Array.isArray(finalRows)) {
      for (const row of finalRows) {
        const rr = row as Record<string, unknown>;
        const sceneIndex = Number(rr.scene_index);
        if (!Number.isFinite(sceneIndex)) continue;

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

