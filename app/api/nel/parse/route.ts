import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type NelParseBody = {
  script: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NelParseBody;
    const script = typeof body?.script === "string" ? body.script : "";
    const trimmed = script.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Missing script" }, { status: 400 });
    }

    // Minimal placeholder analysis to keep onboarding flow working.
    // Replace with real NEL parsing when the endpoint is available.
    const narrativeArc =
      trimmed.length > 250
        ? "Act I: Setup · Act II: Conflict · Act III: Resolution"
        : "Setup · Growth · Climax";
    const tone = /love|romance|甜/i.test(trimmed)
      ? "romantic"
      : /dark|death|血|死亡|悲/i.test(trimmed)
        ? "dramatic"
        : "emotional";

    return NextResponse.json({ narrative_arc: narrativeArc, tone });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

