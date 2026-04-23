import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getLockedBGM } from '@/app/lib/execution-authority'

export const runtime = 'nodejs'
export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Luna (default)
const FFMPEG_URL = process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'

// Generate TTS audio for a single line and upload to Supabase Storage
async function generateTTSAudio(text: string, index: number, movieId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY')

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
      }),
    }
  )

  if (!res.ok) throw new Error(`ElevenLabs TTS failed (line ${index}): ${await res.text()}`)

  const audioBuffer = Buffer.from(await res.arrayBuffer())
  const filePath = `hook/${movieId}/line_${index}_${Date.now()}.mp3`

  const { error: uploadError } = await supabase.storage
    .from('recordings')
    .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

  if (uploadError) throw new Error(`Audio upload failed: ${uploadError.message}`)

  const { data: pub } = supabase.storage.from('recordings').getPublicUrl(filePath)
  return pub.publicUrl
}

// Build 3 hook lines from story_input using simple heuristics
function buildHookLines(storyInput: string): { text: string; startTime: number; endTime: number }[] {
  // Split story into sentences, pick 3 key moments
  const sentences = storyInput
    .split(/[.!?。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5)

  const total = sentences.length

  const line1 = sentences[0] || storyInput.slice(0, 60)
  const line2 = sentences[Math.floor(total / 2)] || storyInput.slice(60, 120)
  const line3 = sentences[total - 1] || storyInput.slice(-60)

  return [
    { text: line1, startTime: 0, endTime: 5 },
    { text: line2, startTime: 5, endTime: 10 },
    { text: line3, startTime: 10, endTime: 13 },
  ]
}

export async function POST(req: NextRequest) {
  try {
    // 1. Accept: { movieId, templateId }
    const { movieId, templateId } = await req.json()
    if (!movieId) return NextResponse.json({ error: 'movieId is required' }, { status: 400 })

    // 2. Get movie record: photo URL, story_input, archetype
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .select('id, twin_photo_url, story_input, archetype, status')
      .eq('id', movieId)
      .single()

    if (movieError || !movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 })
    }

    const photoUrl: string = movie.twin_photo_url
    const storyInput: string = movie.story_input || ''
    const archetype: string = movie.archetype || 'bittersweet'

    if (!photoUrl) return NextResponse.json({ error: 'Movie has no photo URL' }, { status: 400 })
    if (!storyInput) return NextResponse.json({ error: 'Movie has no story_input' }, { status: 400 })

    console.log('[hook/generate] movieId:', movieId, 'archetype:', archetype)

    // 3. Build 3 hook lines and call ElevenLabs TTS
    const subtitles = buildHookLines(storyInput)

    console.log('[hook/generate] generating TTS for 3 lines...')
    const audioUrls: string[] = await Promise.all(
      subtitles.map((line, i) => generateTTSAudio(line.text, i, movieId))
    )
    console.log('[hook/generate] TTS done:', audioUrls.length, 'audio files')

    // 4. Get BGM URL from execution authority by archetype
    const bgmUrl = getLockedBGM(archetype)
    console.log('[hook/generate] BGM:', bgmUrl.split('/').pop())

    // 5. Call Railway FFmpeg /hook endpoint
    const hookPayload = {
      photoUrl,
      audioUrls,
      subtitles,
      bgmUrl,
      duration: 15,
      projectId: movieId,
      ...(templateId ? { templateId } : {}),
    }

    console.log('[hook/generate] calling Railway /hook...')
    const hookRes = await fetch(`${FFMPEG_URL}/hook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hookPayload),
    })

    if (!hookRes.ok) {
      const errText = await hookRes.text().catch(() => 'unknown')
      throw new Error(`Railway /hook failed (${hookRes.status}): ${errText}`)
    }

    const hookData = await hookRes.json() as { success: boolean; hookVideoUrl?: string; error?: string }

    if (!hookData.success || !hookData.hookVideoUrl) {
      throw new Error(`Railway /hook returned no URL: ${hookData.error || 'unknown'}`)
    }

    const hookVideoUrl = hookData.hookVideoUrl
    console.log('[hook/generate] hook video URL:', hookVideoUrl)

    // 6. Save hook_video_url and template_id to movies table
    const updatePayload: Record<string, string> = { hook_video_url: hookVideoUrl }
    if (templateId) updatePayload.template_id = templateId

    const { error: updateError } = await supabase
      .from('movies')
      .update(updatePayload)
      .eq('id', movieId)

    if (updateError) {
      console.error('[hook/generate] failed to save hook_video_url:', updateError.message)
    }

    // 7. Return { hookVideoUrl }
    return NextResponse.json({ hookVideoUrl })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[hook/generate] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
