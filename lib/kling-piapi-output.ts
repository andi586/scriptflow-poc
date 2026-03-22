/**
 * Extract playable video URLs from PiAPI / Kling JSON responses.
 * Supports works[0].resource.resource (Kling v1 video status) and legacy task/output shapes.
 */

function findFirstUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    const m = value.match(/https?:\/\/[^\s"']+/i);
    return m ? m[0] : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrl(item);
      if (found) return found;
    }
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findFirstUrl(v);
      if (found) return found;
    }
  }
  return undefined;
}

/** PiAPI Kling v1: works[0].resource.resource */
function extractFromWorksArray(works: unknown): string | undefined {
  if (!Array.isArray(works) || works.length === 0) return undefined;
  const first = works[0];
  if (!first || typeof first !== "object") return undefined;
  const o = first as Record<string, unknown>;
  const resource = o.resource;
  if (resource && typeof resource === "object") {
    const inner = (resource as Record<string, unknown>).resource;
    if (typeof inner === "string" && /^https?:\/\//i.test(inner)) return inner;
  }
  const videoField = o.video;
  if (videoField && typeof videoField === "object") {
    const url = (videoField as Record<string, unknown>).url;
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return undefined;
}

function collectStatusStrings(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (typeof v === "number" || typeof v === "boolean") parts.push(String(v));
  };
  push(data.status);
  push(data.state);
  const nested = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null;
  if (nested) {
    push(nested.status);
    push(nested.state);
    const out =
      nested.output && typeof nested.output === "object"
        ? (nested.output as Record<string, unknown>)
        : null;
    if (out) {
      push(out.status);
      push(out.state);
    }
  }
  return parts.join(" ").toLowerCase();
}

/** Map PiAPI JSON to terminal state for lazy polling (does not throw). */
export function parseKlingVideoPollTerminal(
  data: Record<string, unknown>,
  videoUrl: string | undefined,
): "processing" | "success" | "failed" {
  const blob = collectStatusStrings(data);
  const hasVideo = typeof videoUrl === "string" && videoUrl.length > 0;
  const normalized = blob.replace(/[^a-z]/g, "");
  if (normalized.includes("fail") || normalized.includes("error")) return "failed";
  if (
    hasVideo ||
    normalized.includes("success") ||
    normalized.includes("succeed") ||
    normalized.includes("complete") ||
    normalized.includes("completed") ||
    normalized.includes("done")
  ) {
    return "success";
  }
  return "processing";
}

export function extractVideoUrlFromPiResponse(data: Record<string, unknown>): string | undefined {
  const rootWorks = extractFromWorksArray(data.works);
  if (rootWorks) return rootWorks;

  const nested =
    data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null;

  if (nested) {
    const w = extractFromWorksArray(nested.works);
    if (w) return w;
  }

  const output =
    nested && nested.output && typeof nested.output === "object"
      ? (nested.output as Record<string, unknown>)
      : null;

  if (!output) {
    return findFirstUrl(data);
  }

  const outputObj = output as Record<string, unknown>;
  const videoObj =
    outputObj.video && typeof outputObj.video === "object"
      ? (outputObj.video as Record<string, unknown>)
      : null;

  const videoUrlFields = [
    outputObj.video_url,
    outputObj.videoUrl,
    outputObj.url,
    videoObj ? videoObj.url : undefined,
  ];
  for (const f of videoUrlFields) {
    if (typeof f === "string" && f.startsWith("http")) return f;
  }

  const works =
    output.works && Array.isArray(output.works) ? (output.works as unknown[]) : null;
  if (works && works.length > 0) {
    const fromW = extractFromWorksArray(works);
    if (fromW) return fromW;
    const first = works[0];
    const videoField =
      first && typeof first === "object"
        ? (first as Record<string, unknown>).video
        : undefined;
    const urlCandidate =
      videoField && typeof videoField === "object" && typeof (videoField as Record<string, unknown>).url === "string"
        ? String((videoField as Record<string, unknown>).url)
        : undefined;
    if (urlCandidate) return urlCandidate;
  }

  return findFirstUrl(output) ?? findFirstUrl(data);
}
