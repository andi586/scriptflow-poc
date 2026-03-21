/**
 * Parse API JSON safely; avoids JSON.parse on HTML/plain-text error pages.
 */
export async function readApiJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const trimmed = text.trim();

  const looksLikeJson =
    trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!contentType.includes("application/json") && !looksLikeJson) {
    const preview = trimmed.slice(0, 240);
    throw new Error(
      preview
        ? `Non-JSON response (${res.status}, ${contentType}): ${preview}`
        : `Non-JSON response (${res.status}, empty body)`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.trim().slice(0, 240);
    throw new Error(
      preview
        ? `Invalid JSON (${res.status}): ${preview}`
        : `Invalid JSON (${res.status}): empty body`,
    );
  }
}
