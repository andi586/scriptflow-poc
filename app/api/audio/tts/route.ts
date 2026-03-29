import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { VOICE_MAP, DEFAULT_VOICE_ID } from '@/lib/audio/voice-map'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function sanitize(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

async function synthesizeWithTimestamps(voiceId: string, text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY')
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({
      text, model_id: 'eleven_multilingual_v2', output_format: 'mp3_44100_128',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs error: ${await res.text()}`)
  const data = await res.json()
  const alignment = data.normalized_alignment ?? data.alignment
  if (!alignment) throw new Error('No alignment returned')
  const audioBuffer = Buffer.from(data.audio_base64, 'base64')
  const durationSeconds = alignment.character_end_times_seconds.length > 0
    ? Math.max(...alignment.character_end_times_seconds) : 0
  return { audioBuffer, alignment, durationSeconds }
}

async function uploadAudio(buffer: Buffer, filePath: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  for (const bucket of ['generated-audio', 'generated-videos']) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, { contentType: 'audio/mpeg', upsert: true })
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      return data.publicUrl
    }
  }
  throw new Error('Failed to upload audio')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.projectId) return NextResponse.json({ success: false, error: 'projectId required' }, { status: 400 })
    const items: any[] = []

    const processLine = async (shotIndex: number, text: string, character?: string, voiceId?: string) => {
      if (!text?.trim()) return
      const vid = voiceId || VOICE_MAP[(character || '').toLowerCase()] || DEFAULT_VOICE_ID
      const { audioBuffer, alignment, durationSeconds } = await synthesizeWithTimestamps(vid, text.trim())
      const filePath = `projects/${sanitize(body.projectId)}/tts/shot-${String(shotIndex).padStart(3,'0')}-${Date.now()}.mp3`
      const audioUrl = await uploadAudio(audioBuffer, filePath)
      items.push({ shotIndex, characterName: character, audioUrl, durationSeconds, timestamps: alignment })
    }

    if (body.segments?.length > 0) {
      const sorted = [...body.segments].sort((a: any, b: any) => a.shotIndex - b.shotIndex)
      for (const seg of sorted) {
        await processLine(seg.shotIndex, seg.text, seg.character ?? seg.characterName, seg.voiceId)
      }
    } else if (body.lines?.length > 0) {
      for (let i = 0; i < body.lines.length; i++) {
        const line = body.lines[i]
        await processLine(i, line.text, line.character)
      }
    } else {
      return NextResponse.json({ success: false, error: 'No lines provided' }, { status: 400 })
    }

    return NextResponse.json({ success: true, audioUrls: items.map((i: any) => i.audioUrl), items })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
