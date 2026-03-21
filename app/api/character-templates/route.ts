import { NextResponse } from "next/server";
import { createAnonClient, createClient } from "@/lib/supabase/server";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("character_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ templates: (data ?? []) as CharacterTemplateRow[] });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const archetype = typeof body.archetype === "string" ? body.archetype.trim() : "";
    const reference_image_url =
      typeof body.reference_image_url === "string" ? body.reference_image_url.trim() : "";
    const kling_prompt_base =
      typeof body.kling_prompt_base === "string" ? body.kling_prompt_base.trim() : "";
    const style_tags = Array.isArray(body.style_tags)
      ? body.style_tags.map((t) => String(t).trim()).filter(Boolean)
      : [];

    if (!name || !archetype || !reference_image_url) {
      return NextResponse.json(
        { error: "Missing required fields: name, archetype, reference_image_url" },
        { status: 400 },
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("character_templates")
      .insert({
        name,
        archetype,
        style_tags,
        reference_image_url,
        kling_prompt_base,
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ template: data as CharacterTemplateRow }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
// force redeploy Sat Mar 21 17:35:24 +07 2026
