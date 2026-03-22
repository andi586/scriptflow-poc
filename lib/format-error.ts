/** Turn Supabase / unknown errors into a readable string (never "[object Object]"). */
export function formatUnknownError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const msg = o.message;
    const details = o.details;
    const hint = o.hint;
    const code = o.code;
    const parts = [msg, details, hint, code]
      .filter((x) => typeof x === "string" && x.length > 0) as string[];
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
