import { createClient } from "@/lib/supabase/server";

export interface CharacterGenetics {
  characterId: string;
  styleVector: {
    appearance: string[];
    costume: string[];
    personalityMarkers: string[];
  };
  promptAnchors: string[];
  negativePrompts: string[];
  consistencyScoreHistory: number[];
}

export async function getCharacterGenetics(
  characterId: string,
): Promise<CharacterGenetics | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, genetics")
    .eq("id", characterId)
    .single();

  if (error || !data) return null;

  if (data.genetics) {
    return {
      characterId: data.id,
      styleVector: data.genetics.style_vector,
      promptAnchors: data.genetics.prompt_anchors,
      negativePrompts: data.genetics.negative_prompts,
      consistencyScoreHistory: data.genetics.consistency_score_history || [],
    };
  }

  // 从现有character数据自动生成genetics
  return buildGeneticsFromCharacter(data);
}

function buildGeneticsFromCharacter(character: {
  id: string;
  name: string;
}): CharacterGenetics {
  return {
    characterId: character.id,
    styleVector: {
      appearance: [],
      costume: [],
      personalityMarkers: [],
    },
    promptAnchors: [`${character.name}`, "consistent character appearance"],
    negativePrompts: ["different person", "costume change", "face change"],
    consistencyScoreHistory: [],
  };
}

export async function saveCharacterGenetics(
  characterId: string,
  genetics: CharacterGenetics,
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("characters")
    .update({
      genetics: {
        style_vector: genetics.styleVector,
        prompt_anchors: genetics.promptAnchors,
        negative_prompts: genetics.negativePrompts,
        consistency_score_history: genetics.consistencyScoreHistory,
      },
    })
    .eq("id", characterId);
}
