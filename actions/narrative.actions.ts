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

    const { data, error } = await supabase
      .from("story_memory")
      .upsert(
        {
          project_id: input.projectId,
          narrative_arc: analysis.narrative_arc,
          tone: analysis.tone,
          visual_style: analysis.visual_style,
          foreshadowing_map: analysis.foreshadowing_map,
          core_visual_symbols: analysis.core_visual_symbols,
          continuity_notes: analysis.cross_episode_continuity_notes,
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
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

