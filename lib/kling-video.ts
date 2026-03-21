/** PiAPI Kling `input.aspect_ratio` — prefer API over prompt text. */
export const KLING_VIDEO_ASPECT_RATIO = "9:16" as const;

/**
 * If PiAPI Kling stops honoring `input.aspect_ratio`, append this to each prompt
 * (single place to edit).
 */
export const ASPECT_RATIO_SUFFIX = "\n\nAspect ratio 9:16.";

export function stripHardcodedAspectRatioFromPrompt(prompt: string): string {
  return prompt
    .replace(/\s*5\)\s*Aspect ratio\s*9:16\.?/gi, "")
    .replace(/\s*Aspect ratio\s*9:16[\s.]*$/i, "")
    .replace(/\s*9:16\s*aspect ratio[\s.]*$/i, "")
    .replace(/\s*-\s*Aspect ratio:\s*9:16[\s.]*$/i, "")
    .trim();
}
