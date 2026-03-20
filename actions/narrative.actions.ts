"use server";

import Anthropic from "@anthropic-ai/sdk";
import { parseScript } from "@/lib/narrative-engine/parser";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import { NARRATIVE_TRANSLATOR_PROMPT } from "@/prompts/nel-sentinel";

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

function stripMarkdownFences(content: string): string {
  return content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
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
            "5) Aspect ratio 9:16",
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

