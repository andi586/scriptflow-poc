import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/movie/generate
 * Body: { twinId: string, story: string, sessionId?: string }
 *
 * Pipeline:
 * 1. Fetch frameUrl from digital_twins table
 * 2. ElevenLabs TTS → dialogue audio from story's first sentence
 * 3. OmniHuman: frameUrl + audio → speaking video (taskId stored in omnihuman_jobs)
 * 4. Return { taskId } — frontend polls /api/omni-human/poll?taskId=xxx
 */
export async function POST(request: NextRequest) {
  try {
    const { twinId, story, sessionId } = await request.json()

    if (!twinId || !story) {
      return NextResponse.json({ error: 'twinId and story are required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── Step 1: Get digital twin frame ────────────────────────────────────
    const { data: twin, error: twinErr } = await supabase
      .from('digital_twins')
      .select('id, frame_url_mid')
      .eq('id', twinId)
      .eq('is_active', true)
      .single()

    if (twinErr || !twin?.frame_url_mid) {
      console.error('[movie/generate] Twin not found:', twinErr?.message)
      return NextResponse.json({ error: 'Digital twin not found' }, { status: 404 })
    }

    const frameUrl = twin.frame_url_mid
    console.log('[movie/generate] twinId:', twinId, 'frameUrl:', frameUrl)

    // ── Step 2: ElevenLabs TTS — first sentence of story ─────────────────
    const firstSentence = story.split(/[.!?]/)[0].trim().slice(0, 300) || story.slice(0, 300)
    console.log('[movie/generate] TTS text:', firstSentence)

    let audioUrl: string | null = null
    try {
      const elevenKey = process.env.ELEVENLABS_API_KEY
      const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL' // default: Bella
      if (elevenKey) {
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: firstSentence,
            model_id: 'eleven_turbo_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })

        if (ttsRes.ok) {
          const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
          const audioPath = `tmp/tts_${Date.now()}.mp3`
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('recordings')
            .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

          if (!uploadErr && uploadData) {
            audioUrl = supabase.storage.from('recordings').getPublicUrl(uploadData.path).data.publicUrl
            console.log('[movie/generate] TTS audioUrl:', audioUrl)
          } else {
            console.warn('[movie/generate] TTS upload failed:', uploadErr?.message)
          }
        } else {
          const errText = await ttsRes.text()
          console.warn('[movie/generate] ElevenLabs TTS failed:', ttsRes.status, errText)
        }
      } else {
        console.warn('[movie/generate] ELEVENLABS_API_KEY not set')
      }
    } catch (ttsErr) {
      console.warn('[movie/generate] TTS error (non-fatal):', ttsErr instanceof Error ? ttsErr.message : ttsErr)
    }

    if (!audioUrl) {
      return NextResponse.json({ error: 'Failed to generate dialogue audio' }, { status: 500 })
    }

    // ── Step 3: Submit OmniHuman task ─────────────────────────────────────
    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    if (!piApiKey) {
      return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
    }

    console.log('[movie/generate] Submitting OmniHuman task...')
    const omniRes = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
      body: JSON.stringify({
        model: 'omni-human',
        task_type: 'omni-human-1.5',
        input: {
          image_url: frameUrl,
          audio_url: audioUrl,
          prompt: 'person speaks naturally, cinematic',
        },
      }),
    })

    if (!omniRes.ok) {
      const errText = await omniRes.text()
      console.error('[movie/generate] OmniHuman submit failed:', omniRes.status, errText)
      return NextResponse.json({ error: `OmniHuman submit failed: ${omniRes.status}` }, { status: 500 })
    }

    const omniData = await omniRes.json()
    const taskId: string | null = omniData?.data?.task_id ?? omniData?.task_id ?? null
    console.log('[movie/generate] OmniHuman taskId:', taskId)

    if (!taskId) {
      return NextResponse.json({ error: 'OmniHuman did not return a taskId' }, { status: 500 })
    }

    // ── Step 4: Store in omnihuman_jobs ───────────────────────────────────
    console.log('[movie/generate] storing audio_url in DB:', audioUrl)
    try {
      const { error: insertErr } = await supabase.from('omnihuman_jobs').insert({
        task_id: taskId,
        status: 'processing',
        image_url: frameUrl,
        audio_url: audioUrl,
        session_id: sessionId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (insertErr) {
        console.error('[movie/generate] DB insert FAILED:', insertErr.message, JSON.stringify(insertErr))
      } else {
        console.log('[movie/generate] DB insert SUCCESS, audio_url:', audioUrl)
      }
    } catch (dbErr) {
      console.error('[movie/generate] DB insert FAILED:', dbErr instanceof Error ? dbErr.message : JSON.stringify(dbErr))
    }

    return NextResponse.json({ success: true, taskId, audioUrl, frameUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[movie/generate] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
