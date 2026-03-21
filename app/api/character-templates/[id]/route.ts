import { jsonError, jsonOk } from "@/lib/api-response";
import { createAnonClient } from "@/lib/supabase/server";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

function isValidTemplateId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function isAllowedPublicUrl(url: string) {
  return /^https?:\/\/.+/i.test(url.trim());
}

/** PATCH JSON body `{ reference_image_url: string }` — updates the template row (upload is client → Storage) */
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const { id: templateId } = await ctx.params;
    if (!templateId || !isValidTemplateId(templateId)) {
      return jsonError("Invalid template id", 400);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const reference_image_url =
      typeof body.reference_image_url === "string" ? body.reference_image_url.trim() : "";
    if (!reference_image_url || !isAllowedPublicUrl(reference_image_url)) {
      return jsonError("reference_image_url must be a non-empty http(s) URL", 400);
    }

    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("character_templates")
      .update({ reference_image_url })
      .eq("id", templateId)
      .select("*")
      .maybeSingle();

    if (error) {
      return jsonError(error.message || "Database update failed", 500);
    }
    if (!data) {
      return jsonError("Template not found", 404);
    }

    return jsonOk({ template: data as CharacterTemplateRow });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return jsonError(message || "Unexpected server error", 500);
  }
}
