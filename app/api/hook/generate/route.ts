import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getLockedBGM } from '@/app/lib/execution-authority'
import Replicate from 'replicate'

export const maxDuration = 120

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel

// ── Replicate SDXL expression generation ─────────────────────────────────────
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

async function generateExpressions(imageUrl: string): Promise<string[]> {
  try {
    // Download user photo
    const photoRes = await fetch(imageUrl)
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer())
    
    // Use GPT Image 2 via our API
    const nativeForm = new globalThis.FormData()
    const blob = new Blob([photoBuffer], { type: 'image/jpeg' })
    nativeForm.append('file', blob, 'user.jpg')
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getscriptflow.com'
    const res = await fetch(`${baseUrl}/api/generate-face-variants`, {
      method: 'POST',
      body: nativeForm
    })
    
    const data = await res.json()
    
    if (data.success && data.images) {
      return [data.images.neutral, data.images.surprised, data.images.fear]
    }
    
    throw new Error('GPT Image 2 failed')
  } catch (err) {
    console.warn('[hook] GPT Image 2 expression failed:', err)
    return [imageUrl, imageUrl, imageUrl]
  }
}
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Color grade by archetype ──────────────────────────────────────────────────
function getColorGrade(archetype: string | null | undefined): string {
  const cold = ['betrayal', 'panic', 'secret_revealed']
  const warm = ['pet_daily', 'baby_growth', 'friendship']
  const epic = ['hero_moment', 'comeback_story']
  if (!archetype) return 'cinematic'
  if (cold.includes(archetype)) return 'cold'
  if (warm.includes(archetype)) return 'warm'
  if (epic.includes(archetype)) return 'epic'
  return 'cinematic'
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function synthesizeLine(voiceId: string, text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('Missing ELEVENLABS_API_KEY')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ElevenLabs TTS error: ${errText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ── Upload audio to Supabase storage ─────────────────────────────────────────
async function uploadAudio(buffer: Buffer, filePath: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const bucket = 'hooks'

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType: 'audio/mpeg', upsert: true })

  if (error) {
    // Fallback to generated-audio bucket
    const { error: err2 } = await supabase.storage
      .from('generated-audio')
      .upload(filePath, buffer, { contentType: 'audio/mpeg', upsert: true })
    if (err2) throw new Error(`Upload failed: ${err2.message}`)
    const { data } = supabase.storage.from('generated-audio').getPublicUrl(filePath)
    return data.publicUrl
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

// ── Generate 3 dialogue lines from story or archetype ────────────────────────
async function generateDialogueLines(story: string, archetype: string | null): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY

  // Try Claude first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `You are a viral short-film hook writer. Based on this story, write exactly 3 short spoken lines for a 15-second hook video. Each line should be emotionally gripping, max 10 words, incomplete sentence style to create curiosity. Return ONLY the 3 lines, one per line, no numbering, no quotes.

Story: ${story}
Archetype: ${archetype || 'cinematic'}`,
            },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text: string = data.content?.[0]?.text ?? ''
        const lines = text.trim().split('\n').filter((l: string) => l.trim()).slice(0, 3)
        if (lines.length === 3) return lines
      }
    } catch (_) {
      // fall through
    }
  }

  // Fallback: derive from archetype
  const fallbacks: Record<string, string[]> = {
    betrayal: ["I trusted you with everything.", "You knew all along.", "And still you said nothing."],
    panic: ["Something is very wrong.", "I didn't think it would end like—", "Wait. This can't be real."],
    secret_revealed: ["They knew. They always knew.", "I found the message.", "Everything was a lie."],
    pet_daily: ["Nobody saw what happened next.", "Wait — did that just…", "I can't believe I did this."],
    baby_growth: ["It started with one small thing.", "I didn't expect to feel this.", "Something happened I can't explain."],
    friendship: ["It was always you.", "There's something you don't know.", "I almost said it that night…"],
    hero_moment: ["They said I couldn't. So I—", "Everything changes after this moment.", "I was done being afraid."],
    comeback_story: ["They said I couldn't. So I—", "I was done being afraid.", "Watch what happens next."],
  }

  return fallbacks[archetype ?? ''] ?? [
    "Something happened I can't explain.",
    "I didn't expect to feel this.",
    "It started with one small thing.",
  ]
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { movieId } = await request.json()
    if (!movieId) return NextResponse.json({ error: 'movieId is required' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    // Step 1: Get movie record
    const { data: movie } = await supabase
      .from('movies')
      .select('*')
      .eq('id', movieId)
      .single()

    if (!movie) return NextResponse.json({ error: 'Movie not found' }, { status: 404 })

    console.log('[hook/generate] movie found:', movie.id, 'archetype:', movie.archetype)

    // Step 2: Get digital twin record
    const { data: twin } = await supabase
      .from('digital_twins')
      .select('id, frame_url_front, frame_url_mid, voice_id')
      .eq('id', movie.user_id)
      .single()

    if (!twin) return NextResponse.json({ error: 'Digital twin not found' }, { status: 404 })

    console.log('[hook/generate] twin found:', twin.id, 'voice_id:', twin.voice_id)

    const voiceId: string = twin.voice_id || DEFAULT_VOICE_ID
    const archetype: string | null = movie.archetype ?? null
    const story: string = movie.story_input ?? ''

    // Step 3: Generate 3 dialogue lines
    const lines = await generateDialogueLines(story, archetype)
    console.log('[hook/generate] dialogue lines:', lines)

    // Step 4: Generate audio for each line via ElevenLabs
    const audioUrls: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const audioBuffer = await synthesizeLine(voiceId, lines[i])
      const filePath = `hooks/${movieId}/line-${i + 1}-${Date.now()}.mp3`
      const url = await uploadAudio(audioBuffer, filePath)
      audioUrls.push(url)
      console.log(`[hook/generate] audio line ${i + 1} uploaded:`, url)
    }

    // Step 5: Determine colorGrade
    const colorGrade = getColorGrade(archetype)
    console.log('[hook/generate] colorGrade:', colorGrade)

    // Step 6: Get BGM URL from execution-authority
    const bgmUrl = getLockedBGM(archetype ?? '')
    console.log('[hook/generate] bgmUrl:', bgmUrl)

    // Step 7: Build subtitles
    const subtitles = [
      { text: lines[0], startTime: 2, endTime: 5 },
      { text: lines[1], startTime: 6, endTime: 9 },
      { text: lines[2], startTime: 10, endTime: 12 },
    ]

    // Step 8: Generate 3 expression variants via Replicate IP-Adapter
    const basePhotoUrl = twin.frame_url_front ?? twin.frame_url_mid
    let photoUrls: string[] = [basePhotoUrl, basePhotoUrl, basePhotoUrl]

    if (process.env.REPLICATE_API_TOKEN) {
      try {
        console.log('[hook/generate] generating expressions via Replicate...')
        photoUrls = await generateExpressions(basePhotoUrl)
        console.log('[hook/generate] expression URLs:', photoUrls)
      } catch (repErr) {
        console.warn('[hook/generate] Replicate failed (using original photo x3):', repErr)
      }
    } else {
      console.log('[hook/generate] REPLICATE_API_TOKEN not set — skipping expression generation')
    }

    // Step 9: Call Railway /hook endpoint
    const railwayPayload = {
      photoUrl: photoUrls[0],
      audioUrls,
      subtitles,
      bgmUrl,
      colorGrade,
      duration: 15,
    }

    console.log('[hook/generate] calling Railway /hook with photoUrls:', photoUrls)

    const railwayRes = await fetch(
      'https://scriptflow-video-merge-production.up.railway.app/hook',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(railwayPayload),
      }
    )

    if (!railwayRes.ok) {
      const errText = await railwayRes.text()
      throw new Error(`Railway /hook error: ${errText}`)
    }

    const railwayData = await railwayRes.json()
    const hookVideoUrl: string = railwayData.hookVideoUrl ?? railwayData.url ?? railwayData.output ?? null

    console.log('[hook/generate] hookVideoUrl:', hookVideoUrl)

    // Step 9: Save hook_video_url to movies table
    if (hookVideoUrl) {
      await supabase
        .from('movies')
        .update({ hook_video_url: hookVideoUrl })
        .eq('id', movieId)
    }

    return NextResponse.json({ hookVideoUrl })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[hook/generate] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
