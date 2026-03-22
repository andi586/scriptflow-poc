/**
 * Lazy-mode Inspiration: when idea is short or missing “who / conflict / ending” signals,
 * show 1–3 follow-up cards. When rich enough, hide cards and allow highlighted Generate.
 */
export const INSPIRATION_RICH_MIN_CHARS = 50;

const CHARACTER_RE =
  /主角|主人公|男主|女主|人物|谁|他|她|女孩|男孩|总裁|狼人|人类|CEO|girl|boy|she|he|character|protagonist|love|falls?\s+for|meet/i;
const CONFLICT_RE =
  /冲突|对抗|敌人|仇人|误会|复仇|秘密|危机|但是|然而|对抗|trap|enemy|conflict|fight|against|rival|secret|war\s+with|old\s+enemy/i;
const ENDING_RE =
  /结局|最后|后来|在一起|分手|反转|发现|和解|团圆|happy\s+end|finally|twist|reveal|reconcile|together\s+at\s+the\s+end|how\s+it\s+ends/i;

export type InspirationGaps = {
  needsCharacter: boolean;
  needsConflict: boolean;
  needsEnding: boolean;
};

export function detectInspirationGaps(text: string): InspirationGaps {
  const t = text.trim();
  return {
    needsCharacter: !CHARACTER_RE.test(t),
    needsConflict: !CONFLICT_RE.test(t),
    needsEnding: !ENDING_RE.test(t),
  };
}

/** Enough length + all three narrative cues present → hide follow-ups & highlight Generate (inspiration mode). */
export function inspirationReadyForGenerate(text: string): boolean {
  const t = text.trim();
  if (t.length < INSPIRATION_RICH_MIN_CHARS) return false;
  const g = detectInspirationGaps(t);
  return !g.needsCharacter && !g.needsConflict && !g.needsEnding;
}

export function shouldShowInspirationFollowUps(
  text: string,
  hasStoryboardShots: boolean,
): boolean {
  if (hasStoryboardShots) return false;
  return !inspirationReadyForGenerate(text.trim());
}
