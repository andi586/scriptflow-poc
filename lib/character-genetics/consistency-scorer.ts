import type { CharacterGenetics } from "./engine";

export interface ConsistencyScore {
  overall: number; // 0-100
  breakdown: {
    appearance: number;
    costume: number;
    personality: number;
  };
  issues: string[];
}

/**
 * MVP版本：基于关键词匹配的简单评分
 * 未来可升级为视觉embedding比对
 */
export function scoreConsistency(
  genetics: CharacterGenetics,
  generatedPrompt: string,
  generatedImageUrl?: string,
): ConsistencyScore {
  const issues: string[] = [];
  let appearanceScore = 100;
  let costumeScore = 100;
  let personalityScore = 100;

  const promptLower = generatedPrompt.toLowerCase();

  // 检查appearance关键词
  const appearanceKeywords = genetics.styleVector.appearance;
  if (appearanceKeywords.length > 0) {
    const matchedCount = appearanceKeywords.filter((kw) =>
      promptLower.includes(kw.toLowerCase()),
    ).length;
    appearanceScore = (matchedCount / appearanceKeywords.length) * 100;
    if (appearanceScore < 70) {
      issues.push(
        `Appearance consistency low: only ${matchedCount}/${appearanceKeywords.length} keywords matched`,
      );
    }
  }

  // 检查costume关键词
  const costumeKeywords = genetics.styleVector.costume;
  if (costumeKeywords.length > 0) {
    const matchedCount = costumeKeywords.filter((kw) =>
      promptLower.includes(kw.toLowerCase()),
    ).length;
    costumeScore = (matchedCount / costumeKeywords.length) * 100;
    if (costumeScore < 70) {
      issues.push(
        `Costume consistency low: only ${matchedCount}/${costumeKeywords.length} keywords matched`,
      );
    }
  }

  // 检查personality markers
  const personalityKeywords = genetics.styleVector.personalityMarkers;
  if (personalityKeywords.length > 0) {
    const matchedCount = personalityKeywords.filter((kw) =>
      promptLower.includes(kw.toLowerCase()),
    ).length;
    personalityScore = (matchedCount / personalityKeywords.length) * 100;
    if (personalityScore < 70) {
      issues.push(
        `Personality consistency low: only ${matchedCount}/${personalityKeywords.length} keywords matched`,
      );
    }
  }

  // 检查negative prompts（不应该出现的词）
  for (const negPrompt of genetics.negativePrompts) {
    if (promptLower.includes(negPrompt.toLowerCase())) {
      issues.push(`Negative prompt detected: "${negPrompt}"`);
      appearanceScore = Math.max(0, appearanceScore - 20);
    }
  }

  const overall = Math.round(
    (appearanceScore + costumeScore + personalityScore) / 3,
  );

  return {
    overall,
    breakdown: {
      appearance: Math.round(appearanceScore),
      costume: Math.round(costumeScore),
      personality: Math.round(personalityScore),
    },
    issues,
  };
}

/**
 * 判断是否需要重新生成
 */
export function shouldRetry(score: ConsistencyScore): boolean {
  return score.overall < 70 || score.issues.length > 2;
}
