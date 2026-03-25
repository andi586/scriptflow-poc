import { NextRequest, NextResponse } from "next/server";
import { matchBGM, type BGMTrack } from "@/lib/audio/bgm-library";

interface BGMRequest {
  beats: {
    beat_number: number;
    emotion: string;
  }[];
}

interface BGMResponse {
  matches: {
    beat_number: number;
    track: BGMTrack;
  }[];
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<BGMResponse | { error: string }>> {
  try {
    const body = (await req.json()) as BGMRequest;

    if (!body.beats || body.beats.length === 0) {
      return NextResponse.json({ error: "No beats provided" }, { status: 400 });
    }

    const matches = body.beats.map((beat) => ({
      beat_number: beat.beat_number,
      track: matchBGM(beat.emotion),
    }));

    return NextResponse.json({ matches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

