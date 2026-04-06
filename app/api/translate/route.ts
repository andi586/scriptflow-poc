import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Translate the following story to English for AI video generation.
IMPORTANT RULES:
1. The person in the uploaded photo is always the MAIN CHARACTER and PROTAGONIST
2. They are the one taking action, not the victim
3. Preserve the original perspective - if the user says 'I discovered...' they are the discoverer
4. Keep dramatic tension and emotional intensity
5. Output only the translated English text, nothing else

Story to translate: ${text.trim()}`,
        },
      ],
    });

    const translated = message.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    return NextResponse.json({ translated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
