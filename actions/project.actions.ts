"use server";

import { createClient } from "@/lib/supabase/server";
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

