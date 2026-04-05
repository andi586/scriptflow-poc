import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * POST /api/projects/[id]/star-photos
 * Body: { photoUrls: string[] }
 *
 * Stores the uploaded star-mode photo URLs into projects.metadata.
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

    // Read existing metadata first so we don't overwrite other fields
    const { data: existing } = await supabase
      .from("projects")
      .select("metadata")
      .eq("id", id)
      .single();

    const existingMeta =
      existing?.metadata && typeof existing.metadata === "object"
        ? existing.metadata
        : {};

    const { error } = await supabase
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

    if (error) {
      console.warn("[star-photos] Supabase update error:", error.message);
      // Still return 200 — non-blocking
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true, count: photoUrls.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[star-photos] Unexpected error:", msg);
    // Always 200 — never block the pipeline
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
