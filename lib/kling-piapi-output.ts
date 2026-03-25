/**
 * Extract playable video URLs from PiAPI / Kling JSON responses.
 * Supports works[0].resource.resource (Kling v1 video status) and legacy task/output shapes.
 */

function isLikelyVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(png|jpg|jpeg|webp)(\?|#|$)/i.test(lower)) return false;
  if (lower.includes(".mp4")) return true;
  if (lower.includes("video")) return true;
  if (lower.includes("cdn")) return true;
  return !/\.(png|jpg|jpeg|webp)(\?|#|$)/i.test(lower);
}

function toValidVideoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return isLikelyVideoUrl(trimmed) ? trimmed : null;
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

export function extractVideoUrlFromPiResponse(data: Record<string, unknown>): string | null {
  const nested =
    data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : null;
  if (!nested) return null;

  const works = Array.isArray(nested.works) ? (nested.works as unknown[]) : [];
  const firstWork =
    works[0] && typeof works[0] === "object"
      ? (works[0] as Record<string, unknown>)
      : null;
  const resource =
    firstWork?.resource && typeof firstWork.resource === "object"
      ? (firstWork.resource as Record<string, unknown>)
      : null;

  // a) response.data.works[0].resource.resource
  const candidateA = toValidVideoUrl(resource?.resource);
  if (candidateA) return candidateA;

  // b) response.data.works[0].resource.url
  const candidateB = toValidVideoUrl(resource?.url);
  if (candidateB) return candidateB;

  // c) response.data.video_url
  const candidateC = toValidVideoUrl(nested.video_url);
  if (candidateC) return candidateC;

  // d) response.data.url
  const candidateD = toValidVideoUrl(nested.url);
  if (candidateD) return candidateD;

  return null;
}
