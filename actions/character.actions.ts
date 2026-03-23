"use server";

import { createClient } from "@/lib/supabase/server";
import { formatUnknownError } from "@/lib/format-error";
import { PROJECT_CAST_TABLE } from "@/lib/project-cast-table";
import { requireProjectId } from "@/lib/project-id";
import {
  CHARACTER_TEMPLATES,
  type CharacterTemplate,
} from "@/lib/character-templates";
import type { ActionResult, CharacterRole } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Full error text for client + logs (Supabase PostgrestError + stacks). */
function lockingCharactersErrorDetail(e: unknown): string {
  const base = formatUnknownError(e);
  const parts: string[] = [base];
  if (e instanceof Error && e.stack) parts.push(e.stack);
  if (e !== null && typeof e === "object" && !(e instanceof Error)) {
    try {
      parts.push(`raw: ${JSON.stringify(e)}`);
    } catch {
      /* ignore */
    }
  }
  return parts.join("\n");
}

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
  reference_image_path?: string | null;
  kling_prompt_base: string | null;
}): CharacterTemplate {
  const rawUrl = row.reference_image_url?.trim() || "";
  const pathLike = row.reference_image_path?.trim() || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const fromPath =
    supabaseUrl && pathLike
      ? `${supabaseUrl}/storage/v1/object/public/character-images/${pathLike.replace(/^\/+/, "")}`
      : "";
  const normalizedReferenceImageUrl =
    /^https?:\/\//i.test(rawUrl) ? rawUrl : fromPath || "https://placehold.co/400x600?text=No+Image";

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
    reference_image_url: normalizedReferenceImageUrl,
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
      .from(PROJECT_CAST_TABLE)
      .select("id,name,archetype,reference_image_url,reference_image_path,kling_prompt_base")
      .is("project_id", null)
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

    type CastInsertRow = {
      project_id: string;
      name: string;
      archetype: string;
      style_tags: string[];
      reference_image_url: string;
      kling_prompt_base: string;
      role: CharacterRole;
      appearance: string;
      personality: string;
      language_fingerprint: string;
      reference_image_path: string;
      appears_in_beats: number[];
    };

    const rows: CastInsertRow[] = [];

    if (dbIds.length > 0) {
      try {
        const { data: dbTemplates, error: qErr } = await supabase
          .from(PROJECT_CAST_TABLE)
          .select("id,name,archetype,style_tags,reference_image_url,kling_prompt_base")
          .is("project_id", null)
          .in("id", dbIds);
        if (qErr) throw qErr;
        for (const row of dbTemplates ?? []) {
          const r = row as {
            id: string;
            name: string;
            archetype: string;
            style_tags: string[] | null;
            reference_image_url: string;
            kling_prompt_base: string | null;
          };
          const tags = Array.isArray(r.style_tags) ? r.style_tags : [];
          const appearanceLine =
            r.kling_prompt_base?.trim() || `${r.name} — appearance from reference image.`;
          rows.push({
            project_id: projectId,
            name: r.name,
            archetype: r.archetype,
            style_tags: tags,
            reference_image_url: r.reference_image_url,
            kling_prompt_base: appearanceLine,
            role: inferRoleFromArchetype(r.name, r.archetype),
            appearance: appearanceLine,
            personality: "From template library.",
            language_fingerprint: "Follow script dialogue fingerprint.",
            reference_image_path: `character_templates/${r.id}`,
            appears_in_beats: [],
          });
        }
      } catch (e) {
        console.error(
          "[ScriptFlow] bindTemplateCharactersAction [step=select_library_templates]",
          lockingCharactersErrorDetail(e),
          e,
        );
        throw e;
      }
    }

    const staticSelected = CHARACTER_TEMPLATES.filter((x) => legacyIds.includes(x.id));
    for (const item of staticSelected) {
      rows.push({
        project_id: projectId,
        name: item.name,
        archetype: item.label,
        style_tags: [],
        reference_image_url: item.reference_image_url,
        kling_prompt_base: item.appearance,
        role: item.role,
        appearance: item.appearance,
        personality: item.personality,
        language_fingerprint: item.language_fingerprint,
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

    try {
      await supabase.from(PROJECT_CAST_TABLE).delete().eq("project_id", projectId);
      if (rows.length > 0) {
        const { error } = await supabase.from(PROJECT_CAST_TABLE).insert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error(
        "[ScriptFlow] bindTemplateCharactersAction [step=delete_or_insert_project_cast]",
        lockingCharactersErrorDetail(e),
        e,
      );
      throw e;
    }

    return { success: true, data: { count: rows.length } };
  } catch (e) {
    const detail = lockingCharactersErrorDetail(e);
    console.error("[ScriptFlow] bindTemplateCharactersAction: locking characters failed", {
      detail,
      projectId: input?.projectId,
      templateIdsLength: input?.templateIds?.length,
      err: e,
    });
    return { success: false, error: detail };
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
      .from("character-images")
      .upload(path, fileBuffer, {
        upsert: true,
        contentType: input.mimeType || "application/octet-stream",
      });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("character-images").getPublicUrl(path);
    const referenceImageUrl = data.publicUrl;

    const appearanceLine = `${input.name} appearance locked by uploaded reference image.`;
    const { error: insertError } = await supabase.from(PROJECT_CAST_TABLE).insert({
      project_id: projectId,
      name: input.name,
      archetype: "custom",
      style_tags: [] as string[],
      reference_image_url: referenceImageUrl,
      kling_prompt_base: appearanceLine,
      role: input.role,
      appearance: appearanceLine,
      personality: "Use script-defined personality.",
      language_fingerprint: "Follow script dialogue fingerprint.",
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
    const rows = input.characters.map((c) => {
      const appearanceLine =
        c.appearance?.trim() || `${c.name} appearance locked by reference image.`;
      return {
        project_id: projectId,
        name: c.name.trim(),
        archetype: "imported",
        style_tags: [] as string[],
        reference_image_url: c.reference_image_url,
        kling_prompt_base: appearanceLine,
        role: c.role,
        appearance: appearanceLine,
        personality: c.personality?.trim() || "Follow script-defined personality.",
        language_fingerprint:
          c.language_fingerprint?.trim() || "Follow script-defined language fingerprint.",
        reference_image_path: c.reference_image_url,
        appears_in_beats: [],
      };
    });
    await supabase.from(PROJECT_CAST_TABLE).delete().eq("project_id", projectId);
    if (rows.length > 0) {
      const { error } = await supabase.from(PROJECT_CAST_TABLE).insert(rows);
      if (error) throw error;
    }
    return { success: true, data: { count: rows.length } };
  } catch (e) {
    return { success: false, error: formatUnknownError(e) };
  }
}
