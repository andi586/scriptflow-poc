import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { scoreHookBlueprint, type HookBlueprint } from "@/lib/emotion-os/scorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateBlueprint(
  prompt: string
): Promise<HookBlueprint> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
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
  
  return JSON.parse(cleaned);
}

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

    // Generate blueprint
    let blueprint = await generateBlueprint(prompt);
    let score = scoreHookBlueprint(blueprint);
    
    console.log('[EmotionCore] Initial score:', score.verdict, 'total:', score.total);
    
    // Auto-kill low scoring blueprints
    if (score.verdict === 'kill') {
      console.log('[EmotionCore] Blueprint killed, regenerating...');
      console.log('[EmotionCore] Issues:', score.issues.join(', '));
      
      // Try once more
      blueprint = await generateBlueprint(prompt);
      score = scoreHookBlueprint(blueprint);
      
      if (score.verdict === 'kill') {
        console.warn('[EmotionCore] Second attempt also killed, using anyway');
        console.warn('[EmotionCore] Issues:', score.issues.join(', '));
        
        // Save to hook_experiments with warning
        const { data: saved } = await supabaseAdmin
          .from("hook_experiments")
          .insert({
            template_id,
            user_input,
            hook_blueprint: blueprint,
            score,
            status: "market_test"
          })
          .select("*")
          .single();

        return NextResponse.json({
          ok: true,
          experiment_id: saved?.id,
          blueprint,
          score,
          warning: 'low_quality_blueprint'
        });
      }
      
      console.log('[EmotionCore] Second attempt approved:', score.verdict, 'total:', score.total);
    }
    
    console.log('[EmotionCore] Blueprint approved:', score.verdict, 'total:', score.total);

    // Save to hook_experiments
    const { data: saved } = await supabaseAdmin
      .from("hook_experiments")
      .insert({
        template_id,
        user_input,
        hook_blueprint: blueprint,
        score,
        status: "market_test"
      })
      .select("*")
      .single();

    return NextResponse.json({
      ok: true,
      experiment_id: saved?.id,
      blueprint,
      score
    });

  } catch (error) {
    console.error("[emotion/generate-hook] error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
