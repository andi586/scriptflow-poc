"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/project-id";
import type { ActionResult } from "@/types";

export async function createProjectAction(input: {
  title: string;
  userId: string;
  language?: string;
}): Promise<ActionResult<{ projectId: string }>> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: input.userId,
        title: input.title,
        language: input.language ?? "en",
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, data: { projectId: data.id as string } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * PoC / demo: creates a project row using SCRIPTFLOW_DEMO_USER_ID (a real auth.users id in Supabase).
 * Set in Vercel env so getscriptflow.com visitors can run the pipeline without hand-pasting UUIDs.
 */
export async function createDemoProjectAction(input?: {
  title?: string;
}): Promise<ActionResult<{ projectId: string }>> {
  const userId = process.env.SCRIPTFLOW_DEMO_USER_ID?.trim() ?? "";
  if (!userId || !isValidUuid(userId)) {
    return {
      success: false,
      error:
        "Server missing SCRIPTFLOW_DEMO_USER_ID (valid Supabase auth user UUID). Create a user in Supabase Auth and set this env var.",
    };
  }
  return createProjectAction({
    title: input?.title?.trim() || "Untitled project",
    userId,
    language: "zh",
  });
}

