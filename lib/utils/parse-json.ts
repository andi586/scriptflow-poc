export function safeParseJSON<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T;
    }

    const firstBracket = raw.indexOf("[");
    const lastBracket = raw.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1) {
      return JSON.parse(raw.slice(firstBracket, lastBracket + 1)) as T;
    }

    throw new Error("Invalid JSON from Claude");
  }
}
