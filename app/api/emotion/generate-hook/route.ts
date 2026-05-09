import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { template_id, title, user_input, primary_emotion, core_tags } = body;

    // Get director rules
    const { data: rules } = await supabaseAdmin
      .from("director_rules")
      .select("rule, reason");

    // Get relevant emotion lines
    const { data: lines } = await supabaseAdmin
      .from("emotion_lines")
      .select("text, why_it_hurts, human_detail")
      .order("universality_score", { ascending: false })
      .limit(5);

    // Get relevant human details
    const { data: details } = await supabaseAdmin
      .from("emotion_details")
      .select("text, visual_symbol, human_truth")
      .order("cinematic_potential", { ascending: false })
      .limit(3);

    // Build prompt for Claude
    const prompt = `You are ScriptFlow's Emotion Director.
Create a 15-second emotional movie hook blueprint.

Director Rules:
${rules?.map(r => `- ${r.rule} (${r.reason})`).join("\n")}

Best emotion lines for inspiration:
${lines?.map(l => `- "${l.text}" (${l.why_it_hurts})`).join("\n")}

Best human details:
${details?.map(d => `- ${d.text}: ${d.visual_symbol}`).join("\n")}

Template: ${title}
User input: ${user_input || "not provided"}
Primary emotion: ${primary_emotion}
Core tags: ${core_tags?.join(", ")}

Generate a HookBlueprint JSON with:
- hook_line_1 (max 8 words)
- hook_line_2 (max 8 words)  
- hook_line_3 (max 8 words)
- breakpoint_line (max 8 words)
- human_detail (specific object)
- silence_moment (describe it)
- emotional_contradiction (one sentence)
- cta (max 5 words, no "unlock")
- shot_plan (4 shots, each with: second, shot, emotion, visual, subtitle)

Return JSON only.`;

    // Call Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    const raw = data?.content?.[0]?.text;
    
    if (!raw) throw new Error("Empty AI response");

    const cleaned = raw
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();
    
    const blueprint = JSON.parse(cleaned);

    // Save to hook_experiments
    const { data: saved } = await supabaseAdmin
      .from("hook_experiments")
      .insert({
        template_id,
        user_input,
        hook_blueprint: blueprint,
        score: { total: 8, verdict: "market_test" },
        status: "market_test"
      })
      .select("*")
      .single();

    return NextResponse.json({
      ok: true,
      experiment_id: saved?.id,
      blueprint
    });

  } catch (error) {
    console.error("[emotion/generate-hook] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
