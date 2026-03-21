import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

type RouteCtx = { params: Promise<{ id: string }> };

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200) || "image";
}

/**
 * POST multipart/form-data with field `file` — uploads to bucket `character-images`
 * and returns `{ reference_image_url }`. Client should then call PATCH to persist on the row.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  try {
    const { id: templateId } = await ctx.params;
    if (!templateId || !/^[0-9a-f-]{36}$/i.test(templateId)) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field (image/*)" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("character_templates")
      .select("id")
      .eq("id", templateId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const objectPath = `${templateId}/${Date.now()}_${safeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("character-images")
      .upload(objectPath, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from("character-images").getPublicUrl(objectPath);
    const reference_image_url = pub.publicUrl;

    return NextResponse.json({ reference_image_url });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH JSON body `{ reference_image_url: string }` — updates the template row */
export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const { id: templateId } = await ctx.params;
    if (!templateId || !/^[0-9a-f-]{36}$/i.test(templateId)) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const reference_image_url =
      typeof body.reference_image_url === "string" ? body.reference_image_url.trim() : "";
    if (!reference_image_url || !/^https:\/\//i.test(reference_image_url)) {
      return NextResponse.json(
        { error: "reference_image_url must be a non-empty https URL" },
        { status: 400 },
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("character_templates")
      .update({ reference_image_url })
      .eq("id", templateId)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template: data as CharacterTemplateRow });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
