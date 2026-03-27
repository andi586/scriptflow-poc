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

/**
 * Submit a video generation task to Kling API
 */
export async function submitKlingVideoTask(opts: {
  prompt: string;
  referenceImageUrls: string[];
  duration?: 5 | 10;
}): Promise<{ taskId: string }> {
  const apiKey = process.env.KLING_API_KEY;
  const apiBase = process.env.KLING_API_BASE || "https://api.piapi.ai/api/v1";

  if (!apiKey) {
    throw new Error("KLING_API_KEY not configured");
  }

  const payload = {
    task_type: "video_generation",
    input: {
      prompt: opts.prompt,
      aspect_ratio: KLING_VIDEO_ASPECT_RATIO,
      duration: opts.duration || 5,
      negative_prompt: "",
      elements: opts.referenceImageUrls.slice(0, 4).map(url => ({ image_url: url })),
      mode: "pro",
      version: "1.6",
    },
  };

  const response = await fetch(`${apiBase}/kling/v1/video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kling API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const taskId = data?.data?.task_id;

  if (!taskId) {
    throw new Error("No task_id returned from Kling API");
  }

  return { taskId };
}
