import type { CharacterGenetics } from "@/lib/character-genetics/engine";

export interface CompiledPrompt {
  original: string;
  compiled: string;
  injectedAnchors: string[];
  negativePrompt: string;
}

/**
 * Prompt Compiler: 将角色genetics注入到原始prompt中
 * 确保角色一致性关键词出现在生成提示词中
 */
export function compilePromptWithCharacter(
  basePrompt: string,
  genetics: CharacterGenetics,
): CompiledPrompt {
  const injectedAnchors: string[] = [];
  let compiled = basePrompt.trim();

  // 1. 注入prompt anchors（角色锚点）
  for (const anchor of genetics.promptAnchors) {
    if (!compiled.toLowerCase().includes(anchor.toLowerCase())) {
      compiled = `${anchor}, ${compiled}`;
      injectedAnchors.push(anchor);
    }
  }

  // 2. 注入style vector关键词
  const styleKeywords: string[] = [];

  if (genetics.styleVector.appearance.length > 0) {
    styleKeywords.push(...genetics.styleVector.appearance);
  }

  if (genetics.styleVector.costume.length > 0) {
    styleKeywords.push(...genetics.styleVector.costume);
  }

  if (genetics.styleVector.personalityMarkers.length > 0) {
    styleKeywords.push(...genetics.styleVector.personalityMarkers);
  }

  // 只注入未出现的关键词
  const missingKeywords = styleKeywords.filter(
    (kw) => !compiled.toLowerCase().includes(kw.toLowerCase()),
  );

  if (missingKeywords.length > 0) {
    const keywordsStr = missingKeywords.join(", ");
    compiled = `${compiled}. Character details: ${keywordsStr}`;
    injectedAnchors.push(...missingKeywords);
  }

  // 3. 构建negative prompt
  const negativePrompt = genetics.negativePrompts.join(", ");

  return {
    original: basePrompt,
    compiled,
    injectedAnchors,
    negativePrompt,
  };
}

/**
 * 批量编译多个角色的prompts
 */
export function compilePromptsWithCharacters(
  basePrompt: string,
  charactersGenetics: CharacterGenetics[],
): CompiledPrompt {
  let compiled = basePrompt.trim();
  const allInjectedAnchors: string[] = [];
  const allNegativePrompts: string[] = [];

  for (const genetics of charactersGenetics) {
    const result = compilePromptWithCharacter(compiled, genetics);
    compiled = result.compiled;
    allInjectedAnchors.push(...result.injectedAnchors);
    allNegativePrompts.push(result.negativePrompt);
  }

  return {
    original: basePrompt,
    compiled,
    injectedAnchors: [...new Set(allInjectedAnchors)],
    negativePrompt: [...new Set(allNegativePrompts)].join(", "),
  };
}
