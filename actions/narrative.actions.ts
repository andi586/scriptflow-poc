"use server";

import { parseScript } from "@/lib/narrative-engine/parser";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

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

