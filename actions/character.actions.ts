"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProjectId } from "@/lib/project-id";
import { CHARACTER_TEMPLATES } from "@/lib/character-templates";
import type { ActionResult, CharacterRole } from "@/types";

type CharacterInput = {
  name: string;
  role: CharacterRole;
  appearance?: string;
  personality?: string;
  language_fingerprint?: string;
  reference_image_url: string;
};

export async function listCharacterTemplatesAction(): Promise<
  ActionResult<{ templates: typeof CHARACTER_TEMPLATES }>
> {
  return { success: true, data: { templates: CHARACTER_TEMPLATES } };
}

export async function bindTemplateCharactersAction(input: {
  projectId: string;
  templateIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const selected = CHARACTER_TEMPLATES.filter((x) => input.templateIds.includes(x.id));
    const supabase = createClient();
    const rows = selected.map((item) => ({
      project_id: projectId,
      name: item.name,
      role: item.role,
      appearance: item.appearance,
      personality: item.personality,
      language_fingerprint: item.language_fingerprint,
      reference_image_url: item.reference_image_url,
      reference_image_path: `templates/${item.id}`,
      appears_in_beats: [],
    }));

    await supabase.from("characters").delete().eq("project_id", projectId);
    if (rows.length > 0) {
      const { error } = await supabase.from("characters").insert(rows);
      if (error) throw error;
    }

    return { success: true, data: { count: rows.length } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function uploadCustomCharacterAction(input: {
  projectId: string;
  name: string;
  role: CharacterRole;
  fileName: string;
  mimeType: string;
  base64Data: string;
}): Promise<ActionResult<{ referenceImageUrl: string; path: string }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/${Date.now()}_${safeName}`;
    const fileBuffer = Buffer.from(input.base64Data, "base64");

    const { error: uploadError } = await supabase.storage
      .from("character-references")
      .upload(path, fileBuffer, {
        upsert: true,
        contentType: input.mimeType || "application/octet-stream",
      });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("character-references").getPublicUrl(path);
    const referenceImageUrl = data.publicUrl;

    const { error: insertError } = await supabase.from("characters").insert({
      project_id: projectId,
      name: input.name,
      role: input.role,
      appearance: `${input.name} appearance locked by uploaded reference image.`,
      personality: "Use script-defined personality.",
      language_fingerprint: "Follow script dialogue fingerprint.",
      reference_image_url: referenceImageUrl,
      reference_image_path: path,
      appears_in_beats: [],
    });
    if (insertError) throw insertError;

    return { success: true, data: { referenceImageUrl, path } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertProjectCharactersAction(input: {
  projectId: string;
  characters: CharacterInput[];
}): Promise<ActionResult<{ count: number }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();
    const rows = input.characters.map((c) => ({
      project_id: projectId,
      name: c.name.trim(),
      role: c.role,
      appearance: c.appearance?.trim() || `${c.name} appearance locked by reference image.`,
      personality: c.personality?.trim() || "Follow script-defined personality.",
      language_fingerprint:
        c.language_fingerprint?.trim() || "Follow script-defined language fingerprint.",
      reference_image_url: c.reference_image_url,
      reference_image_path: c.reference_image_url,
      appears_in_beats: [],
    }));
    await supabase.from("characters").delete().eq("project_id", projectId);
    if (rows.length > 0) {
      const { error } = await supabase.from("characters").insert(rows);
      if (error) throw error;
    }
    return { success: true, data: { count: rows.length } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
