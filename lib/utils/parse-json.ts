export function safeParseJSON<T = unknown>(raw: string): T | null {
  try {
    // 1. Try direct parsing first.
    return JSON.parse(raw) as T;
  } catch {
    // 2. Extract JSON inside markdown code fences.
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as T;
      } catch {}
    }

    // 3. Extract the first object or array block.
    const objMatch = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[1]) as T;
      } catch {}
    }

    console.error("[safeParseJSON] 全部解析策略失败，原始内容前300字：", raw.slice(0, 300));
    return null;
  }
}
