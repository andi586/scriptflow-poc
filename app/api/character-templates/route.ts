import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";
import { seedCharacters, SEEDED_CHARACTER_NAMES } from "@/lib/seed-characters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const PROTECTED_REFERENCE_NAMES = new Set(["Wolf King Caius", "Sweet Girl Next Door", "Marcus"]);

function extractCharacterImagesObjectPath(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, "");
  try {
    const parsed = new URL(url);
    const publicMarker = "/storage/v1/object/public/character-images/";
    const signMarker = "/storage/v1/object/sign/character-images/";
    const marker = parsed.pathname.includes(signMarker) ? signMarker : publicMarker;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length)).replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function buildCharacterImagesPublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  if (!base) return `/storage/v1/object/public/character-images/${normalizedPath}`;
  return `${base}/storage/v1/object/public/character-images/${normalizedPath}`;
}

export async function GET() {
  try {
    const supabase = createAnonClient();
    const { count, error: countError } = await supabase
      .from("character_templates")
      .select("id", { count: "exact", head: true })
      .in("name", [...SEEDED_CHARACTER_NAMES]);
    if (countError) throw countError;
    if ((count ?? 0) === 0) {
      await seedCharacters();
    }

    const { data, error } = await supabase
      .from("character_templates")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    const templates = (data ?? []) as CharacterTemplateRow[];
    const normalized = templates.map((tpl) => {
      const path = extractCharacterImagesObjectPath(tpl.reference_image_url ?? "");
      if (!path) return tpl;
      return { ...tpl, reference_image_url: buildCharacterImagesPublicUrl(path) };
    });

    return NextResponse.json({ templates: normalized });
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

    const supabase = createAnonClient();
    const { data: existingRows, error: existingError } = await supabase
      .from("character_templates")
      .select("id, name, reference_image_url, created_at")
      .ilike("name", name)
      .ilike("archetype", archetype)
      .order("created_at", { ascending: false })
      .limit(1);
    if (existingError) throw existingError;

    let data: CharacterTemplateRow | null = null;
    let error: { message?: string } | null = null;
    const existingId = existingRows?.[0]?.id;
    if (existingId) {
      const existingName = existingRows?.[0]?.name ?? "";
      const existingReference = (existingRows?.[0]?.reference_image_url ?? "").trim();
      if (PROTECTED_REFERENCE_NAMES.has(existingName) && reference_image_url !== existingReference) {
        return NextResponse.json(
          { error: "reference_image_url is protected for this template" },
          { status: 403 },
        );
      }
      const updated = await supabase
        .from("character_templates")
        .update({
          style_tags,
          reference_image_url,
          kling_prompt_base,
        })
        .eq("id", existingId)
        .select("*")
        .single();
      data = (updated.data as CharacterTemplateRow | null) ?? null;
      error = updated.error;
    } else {
      const created = await supabase
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
      data = (created.data as CharacterTemplateRow | null) ?? null;
      error = created.error;
    }

    if (error) throw error;

    return NextResponse.json({ template: data as CharacterTemplateRow }, { status: existingId ? 200 : 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
