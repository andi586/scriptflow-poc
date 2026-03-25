"use server";

import { createClient } from "@/lib/supabase/server";
import { createNewProjectAction } from "@/actions/project.actions";
import { isValidUuid } from "@/lib/project-id";
import type { ActionResult, AspectRatio, ProjectStatus } from "@/types";

function resolveProjectOwnerUserId(): string | null {
  const a = process.env.SCRIPTFLOW_DEMO_USER_ID?.trim();
  const b = process.env.SCRIPTFLOW_PROJECT_OWNER_USER_ID?.trim();
  const id = a || b || "";
  return id && isValidUuid(id) ? id : null;
}

export async function createProject(input: {
  title: string;
  script_raw: string;
  status: ProjectStatus;
  aspect_ratio: AspectRatio;
  video_duration_sec: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = resolveProjectOwnerUserId();
    if (!userId) {
      return {
        success: false,
        error:
          "Server missing SCRIPTFLOW_DEMO_USER_ID or SCRIPTFLOW_PROJECT_OWNER_USER_ID (a valid Supabase Auth user UUID).",
      };
    }

    // Step 1: create the base project row using the existing action.
    const base = await createNewProjectAction({ title: input.title.trim() });
    if (!base.success) return { success: false, error: base.error };
    const projectId = base.data.projectId;

    // Step 2: fill onboarding-specific fields.
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        script_raw: input.script_raw.trim(),
        status: input.status,
        aspect_ratio: input.aspect_ratio,
        video_duration_sec: input.video_duration_sec,
      })
      .eq("id", projectId);

    if (error) throw error;

    return { success: true, data: { id: projectId } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveOnboardingCharacters(input: {
  projectId: string;
  characters: Array<{
    name: string;
    reference_image_url: string;
    reference_image_path: string;
  }>;
}): Promise<ActionResult<{ count: number }>> {
  try {
    const projectId = input.projectId.trim();
    if (!projectId) return { success: false, error: "Missing projectId" };
    if (!input.characters.length) {
      return { success: true, data: { count: 0 } };
    }

    const supabase = createClient();
    const now = new Date().toISOString();

    const rows = input.characters.map((c) => {
      const name = c.name.trim();
      const reference_image_url = c.reference_image_url.trim();
      const reference_image_path = c.reference_image_path.trim();
      return {
        project_id: projectId,
        name,
        role: "supporting",
        appearance: "From reference image (uploaded in onboarding).",
        personality: "From reference image (uploaded in onboarding).",
        language_fingerprint: "Follow script dialogue and emotional beats.",
        reference_image_url,
        reference_image_path,
        appears_in_beats: [],
        created_at: now,
        updated_at: now,
      };
    });

    const { error } = await supabase.from("characters").insert(rows);
    if (error) throw error;

    return { success: true, data: { count: rows.length } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

