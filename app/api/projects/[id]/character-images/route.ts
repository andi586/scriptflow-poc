import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CharacterImagesSchema = z.record(z.string(), z.string().url());

const BodySchema = z.object({
  characterImages: CharacterImagesSchema,
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body: unknown = await req.json();
    const parsed = BodySchema.parse(body);
    const projectId = id.trim();
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .update({ character_images: parsed.characterImages })
      .eq("id", projectId)
      .select("id, character_images")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, project: data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
