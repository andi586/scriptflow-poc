import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaudeForScript(prompt: string): Promise<string> {
  const res = await client.messages.create({
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
