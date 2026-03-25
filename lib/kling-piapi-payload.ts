/**
 * PiAPI Kling — reference images (official field names)
 *
 * - **Kling Elements** (`task_type: "video_generation"`):
 *   Use `input.elements`: an array of **1–4** objects `{ "image_url": "<https URL>" }`.
 *   Docs: https://piapi.ai/docs/kling-api/kling-elements
 *
 * - **Kling o1 / omni** (`task_type: "omni_video_generation"`):
 *   Use `input.images`: **string[]** of image URLs; prompt must reference `@image_1`, `@image_2`, …
 *   Docs: https://piapi.ai/docs/kling-api/kling-o1-api
 *
 * There is **no** documented top-level `reference_images` field on the unified task API for these flows;
 * the above are the exact shapes from PiAPI OpenAPI / docs.
 */

export type KlingElementsImageRef = { image_url: string };

type KlingAspectRatio = "9:16" | "16:9" | "1:1";

export function buildKlingVideoGenerationInput(opts: {
  prompt: string;
  aspectRatio: KlingAspectRatio;
  duration: 5 | 10;
  /** Public HTTPS URLs only; max 4 per Kling Elements spec */
  referenceImageUrls: string[];
}): Record<string, unknown> {
  const urls = opts.referenceImageUrls
    .map((u) => u.trim())
    .filter((u) => /^https:\/\//i.test(u))
    .slice(0, 4);

  const base: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio,
    duration: opts.duration,
  };

  if (urls.length === 0) {
    return base;
  }

  // Kling Elements (1.6): exact shape from PiAPI example request
  const elements: KlingElementsImageRef[] = urls.map((image_url) => ({ image_url }));

  return {
    ...base,
    negative_prompt: "",
    elements,
    mode: "pro",
    aspect_ratio: opts.aspectRatio,
    duration: opts.duration,
    version: "1.6",
  };
}
