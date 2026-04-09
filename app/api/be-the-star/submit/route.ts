import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/be-the-star/submit
 *
 * 1. Call ElevenLabs TTS → mp3 buffer
 * 2. Upload mp3 to Supabase Storage → HTTPS URL
 * 3. Submit OmniHuman task (fast_mode: true)
 * 4. Return { taskId } immediately — do NOT poll
 *
 * Frontend polls /api/be-the-star/poll?taskId=xxx separately.
 */
export async function POST(request: NextRequest) {
  console.log('[be-the-star/submit] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const imageUrl = body.imageUrl as string | null
    const firstLine = body.firstLine as string | null

    if (!imageUrl) return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    if (!firstLine) return NextResponse.json({ error: 'firstLine is required' }, { status: 400 })

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY
    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!elevenLabsKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    if (!piApiKey) return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })

    // ── Step 1: Voice clone (optional) + ElevenLabs TTS → mp3 ────────────────
    const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Luna (fallback)
    const chineseDefaultLine = '我从来没有想到，这一天会来临。但我已经准备好了。'
    const ttsText = firstLine || chineseDefaultLine

    // If user provided a voice recording, clone it first to get a voice_id
    let ttsVoiceId = DEFAULT_VOICE_ID
    const voiceRecordingUrl = body.voiceRecordingUrl as string | null

    if (voiceRecordingUrl) {
      console.log('[be-the-star/submit] voice recording provided, cloning voice...')
      try {
        // Download the recording
        const recRes = await fetch(voiceRecordingUrl)
        if (recRes.ok) {
          const recBuffer = await recRes.arrayBuffer()
          const contentType = recRes.headers.get('content-type') || 'audio/webm'
          const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
          const recBlob = new Blob([recBuffer], { type: contentType })

          // Call ElevenLabs voice clone API
          const cloneForm = new FormData()
          cloneForm.append('name', `user-voice-${Date.now()}`)
          cloneForm.append('files', recBlob, `recording.${ext}`)
          cloneForm.append('remove_background_noise', 'true')

          const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
            method: 'POST',
            headers: { 'xi-api-key': elevenLabsKey },
            body: cloneForm,
          })

          if (cloneRes.ok) {
            const cloneData = await cloneRes.json()
            const clonedVoiceId: string = cloneData.voice_id
            if (clonedVoiceId) {
              ttsVoiceId = clonedVoiceId
              console.log('[be-the-star/submit] voice cloned, voice_id:', clonedVoiceId)
            }
          } else {
            const errText = await cloneRes.text().catch(() => 'unknown')
            console.warn('[be-the-star/submit] voice clone failed (non-fatal):', cloneRes.status, errText)
            // Fall through to default voice
          }
        }
      } catch (cloneErr) {
        console.warn('[be-the-star/submit] voice clone error (non-fatal):', cloneErr instanceof Error ? cloneErr.message : cloneErr)
        // Fall through to default voice
      }
    }

    console.log('[be-the-star/submit] TTS voice_id:', ttsVoiceId, 'text:', ttsText.slice(0, 60))

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ttsVoiceId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
        body: JSON.stringify({
          text: ttsText,
          model_id: 'eleven_multilingual_v2',
          language_code: 'zh',
          output_format: 'mp3_44100_128', // must be mp3 for OmniHuman
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
        }),
      }
    )

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => 'unknown')
      console.error('[be-the-star/submit] TTS error:', ttsRes.status, errText)
      return NextResponse.json({ error: `TTS failed: ${ttsRes.status}` }, { status: 502 })
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
    console.log('[be-the-star/submit] TTS audio bytes:', audioBuffer.length)

    // ── Step 2: Upload mp3 to Supabase Storage ────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceKey)
    const audioPath = `be-the-star/preview_${Date.now()}.mp3`

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadError) {
      console.error('[be-the-star/submit] Supabase upload error:', uploadError.message)
      return NextResponse.json({ error: `Audio upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const audioUrl = supabase.storage.from('recordings').getPublicUrl(audioPath).data.publicUrl
    console.log('[be-the-star/submit] audioUrl:', audioUrl)

    // ── Step 3: Submit OmniHuman task (no polling) ────────────────────────────
    const PIAPI_BASE = 'https://api.piapi.ai/api/v1'
    const taskPayload = {
      model: 'omni-human',
      task_type: 'omni-human-1.5',
      input: {
        image_url: imageUrl,
        audio_url: audioUrl,
        fast_mode: true,
      },
      config: {
        webhook_config: {
          endpoint: 'https://getscriptflow.com/api/omnihuman-webhook',
          secret: 'scriptflow-webhook-2026',
        },
      },
    }

    console.log('[submit] imageUrl:', imageUrl)
    console.log('[submit] audioUrl:', audioUrl)
    console.log('[submit] piapi payload:', JSON.stringify(taskPayload))
    console.log('[be-the-star/submit] submitting OmniHuman task')
    const submitRes = await fetch(`${PIAPI_BASE}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
      body: JSON.stringify(taskPayload),
    })

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => 'unknown')
      console.error('[be-the-star/submit] OmniHuman submit failed:', submitRes.status, errText)
      return NextResponse.json({ error: `OmniHuman submit failed: ${submitRes.status}` }, { status: 502 })
    }

    const submitData = await submitRes.json()
    const taskId: string = submitData?.data?.task_id ?? submitData?.task_id

    if (!taskId) {
      console.error('[be-the-star/submit] no task_id:', JSON.stringify(submitData))
      return NextResponse.json({ error: 'No task_id from OmniHuman' }, { status: 502 })
    }

    console.log('[be-the-star/submit] task submitted, taskId:', taskId)

    // ── Step 4: Insert job record into omnihuman_jobs ─────────────────────────
    try {
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
      const supabase = createSupabaseClient(supabaseUrl, serviceKey)
      const { error: insertError } = await supabase
        .from('omnihuman_jobs')
        .insert({
          task_id: taskId,
          status: 'pending',
        })
      if (insertError) {
        console.warn('[be-the-star/submit] omnihuman_jobs insert error (non-fatal):', insertError.message)
      } else {
        console.log('[be-the-star/submit] omnihuman_jobs row created for taskId:', taskId)
      }
    } catch (dbErr) {
      console.warn('[be-the-star/submit] omnihuman_jobs insert failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    // Return immediately — frontend will poll
    return NextResponse.json({ success: true, taskId, audioUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[be-the-star/submit] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
