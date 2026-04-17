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
 *       ElevenLabs TTS → audioUrl, OmniHuman → omni_task_id, Kling → kling_task_id
 *   - For each shot with type === 'scene':
 *       NO OmniHuman, Kling text-to-video only, status = 'scene_only'
 *   - Insert rows into movie_shots and omnihuman_jobs
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

// ── Helper: Submit OmniHuman ──────────────────────────────────────────────────
async function submitOmniHuman(frameUrl: string, audioUrl: string, piApiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
      body: JSON.stringify({
        model: 'omni-human',
        task_type: 'omni-human-1.5',
        input: { image_url: frameUrl, audio_url: audioUrl, prompt: 'person speaks naturally, cinematic' },
        config: {
          webhook_config: {
            endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/piapi`,
            secret: '',
          },
        },
      }),
    })
    if (!res.ok) { console.warn('[movie/generate] OmniHuman submit failed:', res.status, await res.text()); return null }
    const data = await res.json()
    // Check if task was actually created successfully
    if (!data?.data?.task_id || data?.data?.status === 'failed') {
      console.error('[movie/generate] OmniHuman submission failed:', JSON.stringify(data))
      return null
    }
    const omniTaskId = data.data.task_id
    console.log('[movie/generate] OmniHuman task created:', omniTaskId, 'status:', data.data.status)
    return omniTaskId
  } catch (e) {
    console.warn('[movie/generate] OmniHuman submit error:', e instanceof Error ? e.message : e)
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
          .select('id, omni_task_id, kling_task_id, status')
          .eq('movie_id', jobId)
          .eq('shot_index', shotIndex)
          .single()

        if (existingShot) {
          console.log('[movie/generate] Shot', shotIndex, 'already exists (status:', existingShot.status, '), skipping submission')
          continue
        }

        if (shotType === 'face') {
          // ── FACE SHOT: TTS + OmniHuman + Kling ──────────────────────────
          let audioUrl: string | null = null
          if (elevenKey && shotText) {
            audioUrl = await generateAudioUrl(shotText, supabase, elevenKey, voiceId)
            console.log('[movie/generate] Shot', shotIndex, 'audioUrl:', audioUrl)
          } else {
            console.warn('[movie/generate] Skipping TTS for shot', shotIndex, '- no key or text')
          }

          let omniTaskId: string | null = null
          if (audioUrl) {
            omniTaskId = await submitOmniHuman(frameUrl, audioUrl, piApiKey)
            console.log('[movie/generate] Shot', shotIndex, 'omni_task_id:', omniTaskId)
          }

          const klingTaskId = await submitKling(shotScene, piApiKey, shotDuration)
          console.log('[movie/generate] Shot', shotIndex, 'kling_task_id:', klingTaskId)

          // Insert into omnihuman_jobs so cron can poll OmniHuman
          if (omniTaskId) {
            try {
              const { error: omniInsertErr } = await supabase.from('omnihuman_jobs').insert({
                task_id: omniTaskId,
                status: 'processing',
                image_url: frameUrl,
                audio_url: audioUrl,
                scene_task_id: klingTaskId,
                user_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              if (omniInsertErr) {
                console.error('[movie/generate] omnihuman_jobs insert failed for shot', shotIndex, ':', omniInsertErr.message)
              } else {
                console.log('[movie/generate] omnihuman_jobs insert SUCCESS for shot', shotIndex)
              }
            } catch (omniDbErr) {
              console.error('[movie/generate] omnihuman_jobs insert FATAL for shot', shotIndex, ':', omniDbErr instanceof Error ? omniDbErr.message : omniDbErr)
            }
          }

          // Insert into movie_shots
          try {
            const { error: insertErr } = await supabase.from('movie_shots').insert({
              movie_id: jobId,
              shot_index: shotIndex,
              shot_type: 'face',
              omni_task_id: omniTaskId,
              kling_task_id: klingTaskId,
              audio_url: audioUrl,
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
          // ── SCENE SHOT: Kling only, no OmniHuman ────────────────────────
          const klingTaskId = await submitKling(shotScene, piApiKey, shotDuration)
          console.log('[movie/generate] Scene shot', shotIndex, 'kling_task_id:', klingTaskId)

          try {
            const { error: insertErr } = await supabase.from('movie_shots').insert({
              movie_id: jobId,
              shot_index: shotIndex,
              shot_type: 'scene',
              omni_task_id: null,
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

    // Parallel Kling scene generation
    let sceneTaskId: string | null = null
    try {
      const scenePrompt = (template && scenePrompts[template as string]) ? scenePrompts[template as string] : story
      console.log('[movie/generate] Submitting parallel Kling scene generation, prompt:', scenePrompt.slice(0, 80))
      sceneTaskId = await submitKling(scenePrompt, piApiKey)
      console.log('[movie/generate] Kling scene taskId:', sceneTaskId)
    } catch (sceneErr) {
      console.warn('[movie/generate] Kling scene submit error (non-fatal):', sceneErr instanceof Error ? sceneErr.message : sceneErr)
    }

    // Submit OmniHuman task
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
        webhook_config: {
          endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/piapi`,
          secret: '',
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

    // Store in omnihuman_jobs
    console.log('[movie/generate] storing audio_url in DB:', audioUrl)
    try {
      const { error: insertErr } = await supabase.from('omnihuman_jobs').insert({
        task_id: taskId,
        status: 'processing',
        image_url: frameUrl,
        audio_url: audioUrl,
        scene_task_id: sceneTaskId ?? null,
        user_id: userId,
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

    // suppress unused warning
    void sessionId

    return NextResponse.json({ success: true, taskId, audioUrl, frameUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[movie/generate] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
