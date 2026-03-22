/** 9-shot formatter output → plain script for NEL Sentinel (`parseScript`). */

export type StoryboardShot = {
  number: number;
  sceneDescription: string;
  dialogueOrVoiceover: string;
  emotionalTone: string;
};

export function storyboardShotsToNelScriptText(shots: StoryboardShot[]): string {
  return shots
    .map((s) =>
      [
        `【Shot ${s.number}】`,
        `Visual: ${s.sceneDescription.trim()}`,
        `Dialogue / VO: ${s.dialogueOrVoiceover.trim()}`,
        `Emotional tone: ${s.emotionalTone.trim()}`,
        "",
      ].join("\n"),
    )
    .join("\n");
}

export function normalizeShotFromClaude(raw: unknown, index: number): StoryboardShot {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = Number(o.number ?? o.shot_number ?? o.shotNumber ?? index + 1);
  return {
    number: Number.isFinite(n) && n > 0 ? n : index + 1,
    sceneDescription: String(
      o.scene_description ?? o.scene ?? o.visual ?? o.description ?? "",
    ).trim(),
    dialogueOrVoiceover: String(
      o.dialogue_or_voiceover ?? o.dialogue ?? o.voiceover ?? o.voice_over ?? "",
    ).trim(),
    emotionalTone: String(o.emotional_tone ?? o.tone ?? o.mood ?? "").trim(),
  };
}
