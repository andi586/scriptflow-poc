/**
 * Lazy-mode Inspiration: textarea = user core idea only; follow-up Q&A in separate state.
 * Backend receives `composeInspirationForNel(raw, answers)`.
 */
export const INSPIRATION_RICH_MIN_CHARS = 50;

export type InspirationFollowUpDimension = "character" | "conflict" | "ending";

export type InspirationFollowUpAnswer = {
  question: string;
  answer: string;
};

/** At most one answer per dimension — prevents repeat prompts. */
export type InspirationFollowUpAnswers = Partial<
  Record<InspirationFollowUpDimension, InspirationFollowUpAnswer>
>;

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

/** Gaps from the raw textarea only (not merged answers). */
export function detectInspirationGaps(text: string): InspirationGaps {
  const t = text.trim();
  return {
    needsCharacter: !CHARACTER_RE.test(t),
    needsConflict: !CONFLICT_RE.test(t),
    needsEnding: !ENDING_RE.test(t),
  };
}

/** Merge raw inspiration + structured follow-up answers for NEL / formatStoryIdea. */
export function composeInspirationForNel(
  rawIdea: string,
  answers: InspirationFollowUpAnswers,
): string {
  const parts: string[] = [];
  const core = rawIdea.trim();
  if (core) parts.push(core);
  const order: InspirationFollowUpDimension[] = ["character", "conflict", "ending"];
  for (const d of order) {
    const a = answers[d];
    if (a?.answer?.trim()) {
      parts.push(`[${a.question}]\n${a.answer.trim()}`);
    }
  }
  return parts.join("\n\n");
}

/** Enough length + all three narrative cues (on composed text) → hide follow-up UI & highlight Generate. */
export function inspirationReadyForGenerate(composed: string): boolean {
  const t = composed.trim();
  if (t.length < INSPIRATION_RICH_MIN_CHARS) return false;
  const g = detectInspirationGaps(t);
  return !g.needsCharacter && !g.needsConflict && !g.needsEnding;
}

export function shouldShowInspirationFollowUps(
  composedIdea: string,
  hasStoryboardShots: boolean,
): boolean {
  if (hasStoryboardShots) return false;
  return !inspirationReadyForGenerate(composedIdea.trim());
}

export function inspirationNeedsMoreLength(rawIdea: string): boolean {
  return rawIdea.trim().length < INSPIRATION_RICH_MIN_CHARS;
}
