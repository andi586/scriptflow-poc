import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 10 // 10 × 3s = 30s max

export async function POST(req: NextRequest) {
  const { imageUrl, text, voiceId, voiceRecordingUrl } = await req.json()

  const apiKey = process.env.DID_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'preview_failed' }, { status: 500 })
  }

  if (!apiKey) {
    console.warn('[did-preview] DID_API_KEY not set')
    return NextResponse.json({ success: false, error: 'preview_failed' })
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64')

    // ── Step 0: Generate ElevenLabs audio if voiceRecordingUrl is provided ───
    let audioUrl: string | null = null

    if (voiceRecordingUrl) {
      try {
        const elevenKey = process.env.ELEVENLABS_API_KEY
        if (elevenKey) {
          // Clone voice
          const audioRes = await fetch(voiceRecordingUrl)
          const audioBuffer = await audioRes.arrayBuffer()
          const contentType = audioRes.headers.get('content-type') || 'audio/webm'
          const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
          const form = new FormData()
          form.append('name', `clone-${Date.now()}`)
          form.append('files', new Blob([audioBuffer], { type: contentType }), `recording.${ext}`)
          form.append('remove_background_noise', 'true')
          const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: { 'xi-api-key': elevenKey },
            body: form,
          })
          if (cloneRes.ok) {
            const cloneData = await cloneRes.json()
            const clonedVoiceId = cloneData.voice_id
            if (clonedVoiceId) {
              // Generate TTS audio
              const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${clonedVoiceId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenKey },
                body: JSON.stringify({
                  text: text,
                  model_id: 'eleven_multilingual_v2',
                  output_format: 'mp3_44100_128',
                  voice_settings: { stability: 0.45, similarity_boost: 0.8 },
                }),
              })
              if (ttsRes.ok) {
                const ttsBuffer = await ttsRes.arrayBuffer()
                const { createClient: createSB } = await import('@supabase/supabase-js')
                const sb = createSB(supabaseUrl!, serviceRoleKey!)
                const audioPath = `be-the-star/preview_voice_${Date.now()}.mp3`
                await sb.storage.from('recordings').upload(
                  audioPath,
                  Buffer.from(ttsBuffer),
                  { contentType: 'audio/mpeg', upsert: true }
                )
                audioUrl = sb.storage.from('recordings').getPublicUrl(audioPath).data.publicUrl
                console.log('[did-preview] cloned audio URL:', audioUrl)
              }
            }
          }
        }
      } catch (voiceErr) {
        console.warn('[did-preview] voice clone/TTS failed, falling back to microsoft:', voiceErr)
      }
    }

    // ── Step 1: Create D-ID talk ─────────────────────────────────────────────
    console.log('[did-preview] DID input image:', imageUrl)
    const createRes = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: imageUrl,
        script: audioUrl
          ? { type: 'audio', audio_url: audioUrl }
          : { type: 'text', input: text, provider: { type: 'microsoft', voice_id: 'zh-CN-YunxiNeural' } },
      }),
    })

    const createData = await createRes.json()
    const talkId = createData.id

    if (!talkId) {
      console.error('[did-preview] D-ID talk creation failed:', JSON.stringify(createData))
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }

    console.log('[did-preview] talk created, talkId:', talkId)

    // ── Step 2: Poll until done (max 30s) ────────────────────────────────────
    let resultUrl: string | null = null

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

      const pollRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: { Authorization: `Basic ${auth}` },
      })
      const pollData = await pollRes.json()
      console.log(`[did-preview] poll #${attempt} status:`, pollData.status)

      if (pollData.status === 'done' && pollData.result_url) {
        resultUrl = pollData.result_url
        break
      }

      if (pollData.status === 'error') {
        console.error('[did-preview] D-ID generation error:', JSON.stringify(pollData))
        return NextResponse.json({ success: false, error: 'preview_failed' })
      }
    }

    if (!resultUrl) {
      console.error('[did-preview] D-ID timed out after 30s')
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }

    // ── Step 3: Download video from D-ID (strict binary) ─────────────────────
    const videoRes = await fetch(resultUrl, { cache: 'no-store' })
    if (!videoRes.ok) {
      throw new Error(`D-ID download failed: ${videoRes.status}`)
    }
    if (videoRes.redirected) {
      console.log('[did-preview] redirected to:', videoRes.url)
    }
    const arrayBuffer = await videoRes.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    console.log('[did-preview] video bytes:', uint8.byteLength)

    // ── Step 3.5: Validate minimum size (guard against empty/truncated) ───────
    if (uint8.byteLength < 50000) {
      throw new Error('Video too small, likely corrupted')
    }

    // ── Step 4: Upload to Supabase Storage ───────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const filePath = `did-preview/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`

    const { error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(filePath, uint8, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadErr) {
      throw new Error(`Supabase upload failed: ${uploadErr.message}`)
    }

    const { data: pub } = supabase.storage.from('recordings').getPublicUrl(filePath)
    const finalUrl = pub.publicUrl
    console.log('[did-preview] final URL:', finalUrl)

    return NextResponse.json({ success: true, videoUrl: finalUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[did-preview] unexpected error:', msg)
    return NextResponse.json({ success: false, error: 'preview_failed' })
  }
}
