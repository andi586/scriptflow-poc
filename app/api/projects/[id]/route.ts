import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * DELETE /api/projects/[id]
 * Soft-deletes a project by setting deleted_at = now().
 * Falls back to hard delete if the column doesn't exist.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing project id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try soft delete first (set deleted_at)
    const { error: softErr } = await supabase
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (softErr) {
      // Column may not exist — fall back to hard delete
      const { error: hardErr } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (hardErr) {
        return NextResponse.json({ ok: false, error: hardErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
