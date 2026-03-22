"use server";

import { createClient } from "@/lib/supabase/server";
import { formatUnknownError } from "@/lib/format-error";
import { requireProjectId } from "@/lib/project-id";
import {
  CHARACTER_TEMPLATES,
  type CharacterTemplate,
} from "@/lib/character-templates";
import type { ActionResult, CharacterRole } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inferRoleFromArchetype(name: string, archetype: string): CharacterRole {
  const s = `${name} ${archetype}`.toLowerCase();
  if ((/女主|甜女|甜美女|sweet girl|female lead/.test(s) || /女/.test(archetype)) && !/男主/.test(s))
    return "protagonist_female";
  if (/男主|霸总|狼人|male lead|alpha|ceo|wolf/.test(s) || /男/.test(archetype))
    return "protagonist_male";
  return "supporting";
}

function mapDbRowToTemplate(row: {
  id: string;
  name: string;
  archetype: string;
  reference_image_url: string;
  kling_prompt_base: string | null;
}): CharacterTemplate {
  return {
    id: row.id,
    label: `${row.name}（${row.archetype}）`,
    role: inferRoleFromArchetype(row.name, row.archetype),
    name: row.name,
    appearance:
      row.kling_prompt_base?.trim() ||
      "Appearance locked by reference image; use kling prompt from template when generating.",
    personality: "From ScriptFlow character template library.",
    language_fingerprint: "Follow script dialogue and emotional beats.",
    reference_image_url: row.reference_image_url,
  };
}

type CharacterInput = {
  name: string;
  role: CharacterRole;
  appearance?: string;
  personality?: string;
  language_fingerprint?: string;
  reference_image_url: string;
};

export async function listCharacterTemplatesAction(): Promise<
  ActionResult<{ templates: CharacterTemplate[] }>
> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("character_templates")
      .select("id,name,archetype,reference_image_url,kling_prompt_base")
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        success: true,
        data: { templates: data.map((row) => mapDbRowToTemplate(row)) },
      };
    }

    return { success: true, data: { templates: CHARACTER_TEMPLATES } };
  } catch (e) {
    console.error("listCharacterTemplatesAction:", formatUnknownError(e));
    return { success: true, data: { templates: CHARACTER_TEMPLATES } };
  }
}

export async function bindTemplateCharactersAction(input: {
  projectId: string;
  templateIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  try {
    const projectId = requireProjectId(input.projectId);
    const supabase = createClient();

    const dbIds = input.templateIds.filter((id) => UUID_RE.test(id));
    const legacyIds = input.templateIds.filter((id) => !UUID_RE.test(id));

    type Row = {
      project_id: string;
      name: string;
      role: CharacterRole;
      appearance: string;
      personality: string;
      language_fingerprint: string;
      reference_image_url: string;
      reference_image_path: string;
      appears_in_beats: number[];
    };

    const rows: Row[] = [];

    if (dbIds.length > 0) {
      const { data: dbTemplates, error: qErr } = await supabase
        .from("character_templates")
        .select("id,name,archetype,reference_image_url,kling_prompt_base")
        .in("id", dbIds);
      if (qErr) throw qErr;
      for (const row of dbTemplates ?? []) {
        const r = row as {
          id: string;
          name: string;
          archetype: string;
          reference_image_url: string;
          kling_prompt_base: string | null;
        };
        rows.push({
          project_id: projectId,
          name: r.name,
          role: inferRoleFromArchetype(r.name, r.archetype),
          appearance:
            r.kling_prompt_base?.trim() || `${r.name} — appearance from reference image.`,
          personality: "From template library.",
          language_fingerprint: "Follow script dialogue fingerprint.",
          reference_image_url: r.reference_image_url,
          reference_image_path: `character_templates/${r.id}`,
          appears_in_beats: [],
        });
      }
    }

    const staticSelected = CHARACTER_TEMPLATES.filter((x) => legacyIds.includes(x.id));
    for (const item of staticSelected) {
      rows.push({
        project_id: projectId,
        name: item.name,
        role: item.role,
        appearance: item.appearance,
        personality: item.personality,
        language_fingerprint: item.language_fingerprint,
        reference_image_url: item.reference_image_url,
        reference_image_path: `templates/${item.id}`,
        appears_in_beats: [],
      });
    }

    if (input.templateIds.length > 0 && rows.length === 0) {
      return {
        success: false,
        error:
          "No templates matched your selection. Use templates from the list (Supabase UUIDs or built-in IDs like werewolf-male-lead).",
      };
    }

    await supabase.from("characters").delete().eq("project_id", projectId);
    if (rows.length > 0) {
      const { error } = await supabase.from("characters").insert(rows);
      if (error) throw error;
    }

    return { success: true, data: { count: rows.length } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
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
    return { success: false, error: formatUnknownError(e) };
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
    return { success: false, error: formatUnknownError(e) };
  }
}
