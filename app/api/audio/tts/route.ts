import { NextRequest, NextResponse } from "next/server";
import { VOICE_MAP, DEFAULT_VOICE_ID } from "@/lib/audio/voice-map";
import { createClient } from "@/lib/supabase/server";

interface TTSLine {
  character: string;
  text: string;
}

interface TTSRequest {
  lines: TTSLine[];
  projectId: string;
}

interface TTSResponse {
  audioUrls: string[];
}

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

function sanitizePathSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

async function generateAudio(text: string, voiceId: string): Promise<ArrayBuffer> {
  if (!ELEVEN_API_KEY) throw new Error("Missing ELEVENLABS_API_KEY");

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVEN_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs error: ${errText}`);
  }

  return res.arrayBuffer();
}

async function uploadAudio(buffer: ArrayBuffer, filePath: string): Promise<string> {
  const supabase = await createClient();

  const { error } = await supabase.storage.from("audio").upload(filePath, buffer, {
    contentType: "audio/mpeg",
    upsert: true,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data, error: signedErr } = await supabase.storage
    .from("audio")
    .createSignedUrl(filePath, 3600);

  if (signedErr) throw new Error(`Failed to get signed URL: ${signedErr.message}`);
  if (!data?.signedUrl) throw new Error("Failed to get signed URL");

  return data.signedUrl;
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<TTSResponse | { error: string }>> {
  try {
    const body = (await req.json()) as TTSRequest;

    if (!body.lines || body.lines.length === 0) {
      return NextResponse.json({ error: "No lines provided" }, { status: 400 });
    }

    const audioUrls: string[] = [];

    for (let i = 0; i < body.lines.length; i += 1) {
      const line = body.lines[i];
      if (!line.text || !line.character) {
        throw new Error(`Invalid line at index ${i}`);
      }

      const voiceId = VOICE_MAP[line.character.toLowerCase()] ?? DEFAULT_VOICE_ID;
      const audioBuffer = await generateAudio(line.text, voiceId);

      const characterSlug = sanitizePathSegment(line.character.toLowerCase());
      const projectSlug = sanitizePathSegment(body.projectId);
      const safeIndex = String(i);
      const filePath = `tts/${projectSlug}/${characterSlug}_${safeIndex}_${Date.now()}.mp3`;

      const url = await uploadAudio(audioBuffer, filePath);
      audioUrls.push(url);
    }

    return NextResponse.json({ audioUrls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

