import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function isOverloadedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("status" in error)) return false;
  return (error as { status?: number }).status === 529;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callClaudeWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 3
): Promise<Anthropic.Message> {
  for (let i = 0; i < maxRetries; i += 1) {
    try {
      return await client.messages.create(params);
    } catch (error: unknown) {
      if (isOverloadedError(error) && i < maxRetries - 1) {
        const waitMs = 2000 * (i + 1);
        console.log(`[RETRY ${i + 1}] Anthropic overloaded, waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Claude request failed after retries");
}

export async function callClaudeForScript(prompt: string): Promise<string> {
  const res = await callClaudeWithRetry({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const chunks: string[] = [];
  for (const block of res.content) {
    if (block.type === "text") {
      chunks.push(block.text);
    }
  }
  return chunks.join("");
}
