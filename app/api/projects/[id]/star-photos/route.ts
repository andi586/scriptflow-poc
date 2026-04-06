import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * POST /api/projects/[id]/star-photos
 * Body: { photoUrls: string[] }
 *
 * 1. Stores the uploaded star-mode photo URLs into projects.metadata.
 * 2. Inserts rows into character_templates (project-scoped) so that
 *    submitKlingTasksAction can read reference_image_url and pass them
 *    as Kling Elements to lock character faces.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — this is a server-side route.
 * Failures return 200 so they never block the main pipeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing project id" }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const photoUrls: string[] = Array.isArray(body?.photoUrls) ? body.photoUrls : [];

    if (photoUrls.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 1. Update projects.metadata ──────────────────────────────────────────
    const { data: existing } = await supabase
      .from("projects")
      .select("metadata")
      .eq("id", id)
      .single();

    const existingMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? existing.metadata
        : {};

    const { error: metaError } = await supabase
      .from("projects")
      .update({
        metadata: {
          ...existingMeta,
          star_photo_urls: photoUrls,
          star_photo_count: photoUrls.length,
          star_photos_attached_at: new Date().toISOString(),
        },
      })
      .eq("id", id);

    if (metaError) {
      console.warn("[star-photos] projects.metadata update error:", metaError.message);
    }

    // ── 2. Insert character_templates rows (project-scoped) ──────────────────
    // submitKlingTasksAction queries character_templates WHERE project_id = pid
    // and reads reference_image_url to build Kling Elements.
    // We must use service role here — anon key is blocked by RLS.
    const castRows = photoUrls.slice(0, 4).map((url, i) => ({
      project_id: id,
      name: i === 0 ? "Star" : `Character ${i + 1}`,
      archetype: i === 0 ? "protagonist" : "supporting",
      style_tags: [],
      kling_prompt_base: "",
      role: i === 0 ? "protagonist" : "supporting",
      appearance: "uploaded photo reference",
      reference_image_url: url,
    }));

    const { error: castError } = await supabase
      .from("character_templates")
      .insert(castRows);

    if (castError) {
      console.warn("[star-photos] character_templates insert error:", castError.message);
      // Non-blocking — still return ok so pipeline continues
    } else {
      console.log(`[star-photos] Inserted ${castRows.length} character_templates row(s) for project ${id}`);
      console.log("[star-photos] referenceImageUrls written:", castRows.map((r) => r.reference_image_url));
    }

    return NextResponse.json({ ok: true, count: photoUrls.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[star-photos] Unexpected error:", msg);
    // Always 200 — never block the pipeline
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
