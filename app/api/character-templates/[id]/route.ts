import { jsonError, jsonOk } from "@/lib/api-response";
import { createClient } from "@/lib/supabase/server";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

type RouteCtx = { params: Promise<{ id: string }> };

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "image";
}

function isValidTemplateId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function isAllowedPublicUrl(url: string) {
  return /^https?:\/\/.+/i.test(url.trim());
}

/**
 * POST multipart/form-data with field `file` — uploads to bucket `character-images`
 * and returns `{ reference_image_url }`. Client should then call PATCH to persist on the row.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const { id: templateId } = await ctx.params;
    if (!templateId || !isValidTemplateId(templateId)) {
      return jsonError("Invalid template id", 400);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Invalid multipart body", 400);
    }

    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return jsonError("Missing file field (image/*)", 400);
    }
    if (!file.type.startsWith("image/")) {
      return jsonError("File must be an image", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("Image too large (max 10MB)", 400);
    }

    const supabase = createClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("character_templates")
      .select("id")
      .eq("id", templateId)
      .maybeSingle();
    if (fetchErr) {
      return jsonError(fetchErr.message || "Database error", 500);
    }
    if (!existing) {
      return jsonError("Template not found", 404);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const objectPath = `${templateId}/${Date.now()}_${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("character-images")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) {
      return jsonError(uploadError.message || "Storage upload failed", 500);
    }

    const { data: pub } = supabase.storage.from("character-images").getPublicUrl(objectPath);
    const reference_image_url = pub.publicUrl;
    if (!reference_image_url || !isAllowedPublicUrl(reference_image_url)) {
      return jsonError("Could not resolve public URL for uploaded object", 500);
    }

    return jsonOk({ reference_image_url });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return jsonError(message || "Unexpected server error", 500);
  }
}

/** PATCH JSON body `{ reference_image_url: string }` — updates the template row */
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

    const supabase = createClient();
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
