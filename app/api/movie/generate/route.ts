import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/movie/generate
 * Body: { twinId: string, story: string, sessionId?: string, template?: string, shots?: Shot[] }
 *
 * If shots array provided (NEL Director output):
 *   - For each shot with type === 'face':
 *       ElevenLabs TTS → audioUrl
 *       Use twin.frame_url_mid directly as video source (NO OmniHuman)
 *       Final video = FFmpeg merge of (twin frame image + TTS audio) via Railway FFmpeg service
 *   - For each shot with type === 'scene':
 *       Kling text-to-video only
 *   - Insert rows into movie_shots
 *   - Return { movieId, totalShots }
 *
 * Fallback (no shots): single-video pipeline
 */

interface NarrativeState {
  tension: number
  beat: string
  goal: string
  emotion: string
}

interface Shot {
  shot_index?: number
  shot?: number
  type?: 'face' | 'scene'
  text?: string
  scene?: string
  duration?: number
  narrative?: NarrativeState
}

const scenePrompts: Record<string, string> = {
  'Dear Mom': 'Empty room with warm candlelight, flowers on the table, family photos on the wall, golden hour sunlight through curtains, no people, no humans, no figures, cinematic atmosphere, emotional and tender',
  'Let Them Go': 'Empty rooftop at sunset overlooking the city lights, dramatic cinematic lighting, no people, no humans, no figures, emotional atmosphere, freedom',
  'Letter to My Younger Self': 'Empty nostalgic childhood bedroom, old photographs on desk, soft warm light, no people, no humans, no figures, emotional and reflective',
  'I Deserve Better': 'Beautiful empty city street at night, dramatic lighting, empowerment atmosphere, no people, no humans, no figures, cinematic',
  'Things I Never Said': 'Empty chair by a window at sunset, letters on a table, no people, no humans, no figures, emotional and poetic atmosphere',
  'I Finally Love Myself': 'Beautiful empty garden at golden hour, flowers blooming, peaceful and joyful atmosphere, no people, no humans, no figures',
}

// ── Helper: ElevenLabs TTS → upload → public URL ──────────────────────────────
async function generateAudioUrl(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  elevenKey: string,
  voiceId: string,
): Promise<string | null> {
  try {
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 300),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    })
    if (!ttsRes.ok) {
      console.warn('[movie/generate] ElevenLabs TTS failed:', ttsRes.status, await ttsRes.text())
      return null
    }
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
    if (audioBuffer.length < 100) { console.error('[movie/generate] TTS buffer too small'); return null }
    const audioPath = `tmp/tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(audioPath, audioBuffer, { contentType: 'audio/mpeg', upsert: false, cacheControl: '3600' })
    if (uploadErr || !uploadData) { console.warn('[movie/generate] TTS upload failed:', uploadErr?.message); return null }
    return supabase.storage.from('recordings').getPublicUrl(uploadData.path).data.publicUrl
  } catch (e) {
    console.warn('[movie/generate] TTS error:', e instanceof Error ? e.message : e)
    return null
  }
}

// ── Helper: Submit Kling text-to-video ────────────────────────────────────────
async function submitKling(scenePrompt: string, piApiKey: string, duration = 10): Promise<string | null> {
  try {
    const res = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
        body: JSON.stringify({
          model: 'kling',
          task_type: 'video_generation',
          input: {
            prompt: scenePrompt,
            negative_prompt: 'people, humans, figures, person, man, woman, face, body, character',
            version: '3.0',
            mode: 'pro',
            duration,
            aspect_ratio: '9:16',
            enable_audio: true,
          },
          webhook_config: {
            endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/piapi`,
            secret: '',
          },
        }),
    })
    if (!res.ok) { console.warn('[movie/generate] Kling submit failed:', res.status, await res.text()); return null }
    const data = await res.json()
    return data?.data?.task_id ?? null
  } catch (e) {
    console.warn('[movie/generate] Kling submit error:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { story, sessionId, template, shots } = await request.json()

    if (!story) {
      return NextResponse.json({ error: 'story is required' }, { status: 400 })
    }

    // Get current user from auth session
    const serverSupabase = await createServerClient()
    const { data: { session } } = await serverSupabase.auth.getSession()
    const userId = session?.user?.id ?? null

    // Always use service role key (admin) so RLS doesn't block inserts
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    // ── Get digital twin frame + voice_id ─────────────────────────────────────
    // First try to find twin with voice_id
    let { data: twin } = await supabase
      .from('digital_twins')
      .select('id, frame_url_mid, voice_id')
      .not('voice_id', 'is', null)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fallback: find any active twin with frame_url_mid
    if (!twin) {
      const { data: fallback } = await supabase
        .from('digital_twins')
        .select('id, frame_url_mid, voice_id')
        .eq('is_active', true)
        .not('frame_url_mid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      twin = fallback
    }

    console.log('[movie/generate] Using twin:', twin?.id, 'voice_id:', twin?.voice_id)

    if (!twin?.frame_url_mid) {
      console.error('[movie/generate] No active digital twin found')
      return NextResponse.json({ error: 'Digital twin not found' }, { status: 404 })
    }

    const frameUrl = twin.frame_url_mid
    console.log('[movie/generate] twin.id:', twin.id, 'frameUrl:', frameUrl)

    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    console.log('[movie/generate] PIAPI_API_KEY present:', !!process.env.PIAPI_API_KEY)
    if (!piApiKey) {
      return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
    }

    const elevenKey = process.env.ELEVENLABS_API_KEY
    // Use cloned voice from digital twin if available, fall back to env or default
    const voiceId = twin.voice_id ?? process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB' // Adam - multilingual
    console.log('[movie/generate] Using voiceId:', voiceId, twin.voice_id ? '(cloned)' : '(default)')

    // ════════════════════════════════════════════════════════════════════════
    // MULTI-SHOT PATH (NEL Director output)
    // ════════════════════════════════════════════════════════════════════════
    if (Array.isArray(shots) && shots.length > 0) {
      const jobId = crypto.randomUUID()
      console.log('[movie/generate] Multi-shot mode, jobId:', jobId, 'shots:', shots.length)

      // Submit face shots first (critical path), then scene shots
      const faceShots = (shots as Shot[]).filter(s => (s.type ?? 'face') === 'face')
      const sceneShots = (shots as Shot[]).filter(s => s.type === 'scene')
      const orderedShots = [...faceShots, ...sceneShots]
      console.log('[movie/generate] Submission order: face shots first:', faceShots.length, 'then scene shots:', sceneShots.length)

      for (const [idx, shot] of orderedShots.entries()) {
        const shotIndex = shot.shot_index ?? (shot as { shotNumber?: number }).shotNumber ?? (idx + 1)
        const shotType = shot.type ?? 'face'
        const shotText = shot.text ?? ''
        const shotScene = shot.scene ?? (template && scenePrompts[template as string] ? scenePrompts[template as string] : story)
        const shotDuration = shot.duration ?? 10
        const shotNarrative = shot.narrative ?? null

        console.log('[movie/generate] Processing shot', shotIndex, 'type:', shotType)

        // BUG 1: Check if this shot already exists for this movie to prevent duplicate submissions
        const { data: existingShot } = await supabase
          .from('movie_shots')
          .select('id, kling_task_id, status')
          .eq('movie_id', jobId)
          .eq('shot_index', shotIndex)
          .single()

        if (existingShot) {
          console.log('[movie/generate] Shot', shotIndex, 'already exists (status:', existingShot.status, '), skipping submission')
          continue
        }

        if (shotType === 'face') {
          // ── FACE SHOT: TTS audio + twin frame image (NO OmniHuman) ──────────
          // Final video = FFmpeg merge of (twin.frame_url_mid + TTS audio)
          // handled by Railway FFmpeg service via the worker
          let audioUrl: string | null = null
          if (elevenKey && shotText) {
            audioUrl = await generateAudioUrl(shotText, supabase, elevenKey, voiceId)
            console.log('[movie/generate] Shot', shotIndex, 'audioUrl:', audioUrl)
          } else {
            console.warn('[movie/generate] Skipping TTS for shot', shotIndex, '- no key or text')
          }

          // Insert into movie_shots - store twin frame as twin_frame_url so worker
          // can merge frame image + audio via Railway FFmpeg /merge-audio
          // status='submitted' so worker picks it up
          try {
            const { error: insertErr } = await supabase.from('movie_shots').insert({
              movie_id: jobId,
              shot_index: shotIndex,
              shot_type: 'face',
              kling_task_id: null,
              audio_url: audioUrl,
              twin_frame_url: frameUrl,
              narrative: shotNarrative,
              status: 'submitted',
              user_id: userId,
              created_at: new Date().toISOString(),
            })
            if (insertErr) {
              console.error('[movie/generate] movie_shots insert failed for shot', shotIndex, ':', insertErr.message)
            } else {
              console.log('[movie/generate] movie_shots insert SUCCESS for face shot', shotIndex)
            }
          } catch (dbErr) {
            console.error('[movie/generate] movie_shots insert FATAL for shot', shotIndex, ':', dbErr instanceof Error ? dbErr.message : dbErr)
          }

        } else {
          // ── SCENE SHOT: Kling only ───────────────────────────────────────────
          const klingTaskId = await submitKling(shotScene, piApiKey, shotDuration)
          console.log('[movie/generate] Scene shot', shotIndex, 'kling_task_id:', klingTaskId)

          try {
            const { error: insertErr } = await supabase.from('movie_shots').insert({
              movie_id: jobId,
              shot_index: shotIndex,
              shot_type: 'scene',
              kling_task_id: klingTaskId,
              audio_url: null,
              narrative: shotNarrative,
              status: 'submitted',
              user_id: userId,
              created_at: new Date().toISOString(),
            })
            if (insertErr) {
              console.error('[movie/generate] movie_shots insert failed for scene shot', shotIndex, ':', insertErr.message)
            } else {
              console.log('[movie/generate] movie_shots insert SUCCESS for scene shot', shotIndex)
            }
          } catch (dbErr) {
            console.error('[movie/generate] movie_shots insert FATAL for scene shot', shotIndex, ':', dbErr instanceof Error ? dbErr.message : dbErr)
          }
        }
      }

      return NextResponse.json({ movieId: jobId, totalShots: (shots as Shot[]).length })
    }

    // ════════════════════════════════════════════════════════════════════════
    // SINGLE-VIDEO FALLBACK (original logic)
    // ════════════════════════════════════════════════════════════════════════
    console.log('[movie/generate] Single-video fallback mode')

    // ElevenLabs TTS — first sentence of story
    const firstSentence = story.split(/[.!?]/)[0].trim().slice(0, 300) || story.slice(0, 300)
    console.log('[movie/generate] TTS text:', firstSentence)

    let audioUrl: string | null = null
    try {
      if (elevenKey) {
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: firstSentence,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        })

        if (ttsRes.ok) {
          console.log('[movie/generate] ElevenLabs response headers:', Object.fromEntries(ttsRes.headers.entries()))
          const audioBuffer = Buffer.from(await ttsRes.arrayBuffer())
          console.log('[movie/generate] TTS audio buffer size:', audioBuffer.length, 'bytes')
          if (audioBuffer.length < 100) {
            console.error('[movie/generate] TTS audio buffer too small, likely invalid')
            throw new Error('TTS audio buffer invalid')
          }
          const audioPath = `tmp/tts_${Date.now()}.mp3`
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('recordings')
            .upload(audioPath, audioBuffer, {
              contentType: 'audio/mpeg',
              upsert: false,
              cacheControl: '3600',
            })

          if (!uploadErr && uploadData) {
            audioUrl = supabase.storage.from('recordings').getPublicUrl(uploadData.path).data.publicUrl
            console.log('[movie/generate] TTS audioUrl:', audioUrl)
          } else {
            console.warn('[movie/generate] TTS upload failed:', uploadErr?.message)
            console.error('[movie/generate] TTS upload full error:', JSON.stringify(uploadErr, null, 2))
            console.log('[movie/generate] TTS upload bucket: recordings, path:', audioPath)
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

    // suppress unused warning
    void sessionId

    // Single-video fallback: return frame + audio for FFmpeg merge by caller
    return NextResponse.json({ success: true, audioUrl, frameUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[movie/generate] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
