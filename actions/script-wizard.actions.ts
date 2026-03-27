"use server";

import { createClient } from "@/lib/supabase/server";
import { createNewProjectAction } from "@/actions/project.actions";
import type { ActionResult } from "@/types";
import type { DevelopExpandResponse, Direction, StructureResponse } from "@/types/script";

export async function finalizeScriptWizardProjectAction(input: {
  idea: string;
  selectedDirection: Direction;
  expandResult: DevelopExpandResponse;
  structureResult: StructureResponse;
  episodeCount: 3 | 6 | 9;
  directions: Direction[];
  userId: string;
}): Promise<ActionResult<{ projectId: string }>> {
  try {
    const title = input.expandResult.title?.trim() || "New project";
    const base = await createNewProjectAction({ title, userId: input.userId });
    console.log("[BASE RESULT]", JSON.stringify(base));
    if (!base.success) return { success: false, error: base.error };
    const projectId = base.data.projectId;
    console.log("[PROJECT ID]", projectId);

    const supabase = await createClient();
    const scriptRaw = JSON.stringify({
      idea: input.idea,
      selectedDirection: input.selectedDirection,
      expandedStory: input.expandResult,
      structure: input.structureResult,
      totalEpisodes: input.episodeCount,
    });

    const { error: projectError } = await supabase
      .from("projects")
      .update({
        title,
        script_raw: scriptRaw,
        status: "analyzing",
      })
      .eq("id", projectId);
    if (projectError) throw projectError;

    const { error: draftError } = await supabase.from("script_drafts").upsert(
      {
        project_id: projectId,
        inspiration_input: input.idea,
        story_directions: input.directions,
        selected_direction: input.selectedDirection.summary,
        three_act_structure: input.structureResult.threeAct,
        episode_outlines: input.structureResult.episodes,
        status: "confirmed",
      },
      { onConflict: "project_id" }
    );
    if (draftError) throw draftError;

    return { success: true, data: { projectId } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
