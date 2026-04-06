import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/voice-clone
 * Body: { audioUrl: string, projectId: string }
 *
 * 1. Downloads the audio file from Supabase storage URL
 * 2. Calls ElevenLabs /v1/voices/add to clone the voice
 * 3. Saves the returned voice_id to projects.user_voice_id
 * 4. Returns { ok: true, voiceId }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { audioUrl?: string; projectId?: string }
    const { audioUrl, projectId } = body

    if (!audioUrl || !projectId) {
      return NextResponse.json({ ok: false, error: 'Missing audioUrl or projectId' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
    }

    // ── 1. Download audio from Supabase public URL ──────────────────────────
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to download audio: HTTP ${audioRes.status}` },
        { status: 502 }
      )
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
    if (audioBuffer.length === 0) {
      return NextResponse.json({ ok: false, error: 'Downloaded audio is empty' }, { status: 422 })
    }

    // Detect content type from URL extension
    const ext = audioUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'webm'
    const mimeType = ext === 'mp4' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : 'audio/webm'
    const fileName = `recording.${ext}`

    // ── 2. Call ElevenLabs voice cloning API ────────────────────────────────
    const formData = new FormData()
    formData.append('name', `user_${projectId.slice(0, 8)}`)
    formData.append('description', 'Auto-cloned from user recording')
    formData.append(
      'files',
      new Blob([audioBuffer], { type: mimeType }),
      fileName
    )

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        // Do NOT set Content-Type — let fetch set it with boundary for FormData
      },
      body: formData,
    })

    const cloneText = await cloneRes.text()
    console.log('[voice-clone] ElevenLabs response status:', cloneRes.status)
    console.log('[voice-clone] ElevenLabs response body:', cloneText.slice(0, 500))

    if (!cloneRes.ok) {
      return NextResponse.json(
        { ok: false, error: `ElevenLabs voice clone failed: ${cloneText.slice(0, 300)}` },
        { status: 502 }
      )
    }

    let cloneData: { voice_id?: string } = {}
    try {
      cloneData = JSON.parse(cloneText)
    } catch {
      return NextResponse.json(
        { ok: false, error: 'ElevenLabs returned non-JSON response' },
        { status: 502 }
      )
    }

    const voiceId = cloneData.voice_id
    if (!voiceId) {
      return NextResponse.json(
        { ok: false, error: 'ElevenLabs did not return voice_id' },
        { status: 502 }
      )
    }

    console.log('[voice-clone] Got voice_id:', voiceId, 'for project:', projectId)

    // ── 3. Save voice_id to projects.user_voice_id ──────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { error: updateError } = await supabase
      .from('projects')
      .update({ user_voice_id: voiceId })
      .eq('id', projectId)

    if (updateError) {
      console.error('[voice-clone] Failed to save user_voice_id:', updateError.message)
      // Non-fatal: return voiceId anyway so caller can use it
    } else {
      console.log('[voice-clone] Saved user_voice_id to project:', projectId)
    }

    return NextResponse.json({ ok: true, voiceId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[voice-clone] Unexpected error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
