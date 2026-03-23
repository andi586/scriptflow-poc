import "server-only";

import { createClient } from "@/lib/supabase/server";

type SeedCharacterRow = {
  name: string;
  archetype: string;
  style_tags: string[];
  reference_image_url: string;
  kling_prompt_base: string;
  project_id: null;
};

const SEEDED_CHARACTERS: SeedCharacterRow[] = [
  {
    name: "Caius",
    archetype: "male lead",
    style_tags: ["alpha", "werewolf king", "modern CEO"],
    reference_image_url: "https://placehold.co/400x600?text=Caius",
    kling_prompt_base: "Alpha werewolf king and modern CEO. Placeholder profile.",
    project_id: null,
  },
  {
    name: "Luna",
    archetype: "female lead",
    style_tags: ["female lead", "romance", "warm"],
    reference_image_url: "https://placehold.co/400x600?text=Luna",
    kling_prompt_base: "Female lead. Placeholder profile.",
    project_id: null,
  },
  {
    name: "Marcus",
    archetype: "villain messenger",
    style_tags: ["villain", "messenger", "dark", "intense"],
    reference_image_url: "https://placehold.co/400x600?text=Marcus",
    kling_prompt_base: "Villain messenger. Placeholder profile.",
    project_id: null,
  },
];

export async function seedCharacters() {
  const supabase = createClient();

  const { error } = await supabase.from("character_templates").upsert(SEEDED_CHARACTERS, {
    onConflict: "name",
  });

  if (!error) return;

  const msg = error.message ?? "";
  const noConflictTarget =
    msg.includes("no unique") || msg.includes("ON CONFLICT specification");
  if (!noConflictTarget) throw error;

  for (const character of SEEDED_CHARACTERS) {
    const { data: existing, error: findError } = await supabase
      .from("character_templates")
      .select("id")
      .eq("name", character.name)
      .is("project_id", null)
      .maybeSingle();
    if (findError) throw findError;

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("character_templates")
        .update({
          archetype: character.archetype,
          style_tags: character.style_tags,
          reference_image_url: character.reference_image_url,
          kling_prompt_base: character.kling_prompt_base,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("character_templates").insert(character);
      if (insertError) throw insertError;
    }
  }
}
