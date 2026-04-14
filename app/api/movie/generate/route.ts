import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/movie/generate
 * Body: { twinId: string, story: string, sessionId?: string, template?: string, shots?: Shot[] }
 *
 * If shots array provided:
 *   - For each shot: ElevenLabs TTS → audioUrl, OmniHuman → omni_task_id, Kling → kling_task_id
 *   - Insert rows into movie_shots table
 *   - Return { movieId, totalShots }
 *
 * Fallback (no shots): single-video pipeline
 */

interface Shot {
  shot: number
  text: string
  scene: string
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
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
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
async function submitKling(scenePrompt: string, piApiKey: string): Promise<string | null> {
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
          duration: 10,
          aspect_ratio: '9:16',
          enable_audio: true,
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
      }),
    })
    if (!res.ok) { console.warn('[movie/generate] OmniHuman submit failed:', res.status, await res.text()); return null }
    const data = await res.json()
    return data?.data?.task_id ?? data?.task_id ?? null
  } catch (e) {
    console.warn('[movie/generate] OmniHuman submit error:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { twinId, story, sessionId, template, shots } = await request.json()

    if (!twinId || !story) {
      return NextResponse.json({ error: 'twinId and story are required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── Get digital twin frame ────────────────────────────────────────────────
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

    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    if (!piApiKey) {
      return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
    }

    const elevenKey = process.env.ELEVENLABS_API_KEY
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'

    // ════════════════════════════════════════════════════════════════════════
    // MULTI-SHOT PATH
    // ════════════════════════════════════════════════════════════════════════
    if (Array.isArray(shots) && shots.length > 0) {
      const jobId = crypto.randomUUID()
      console.log('[movie/generate] Multi-shot mode, jobId:', jobId, 'shots:', shots.length)

      for (const shot of shots as Shot[]) {
        console.log('[movie/generate] Processing shot', shot.shot)

        // TTS for this shot
        let audioUrl: string | null = null
        if (elevenKey) {
          audioUrl = await generateAudioUrl(shot.text, supabase, elevenKey, voiceId)
          console.log('[movie/generate] Shot', shot.shot, 'audioUrl:', audioUrl)
        } else {
          console.warn('[movie/generate] ELEVENLABS_API_KEY not set, skipping TTS for shot', shot.shot)
        }

        // OmniHuman (requires audioUrl)
        let omniTaskId: string | null = null
        if (audioUrl) {
          omniTaskId = await submitOmniHuman(frameUrl, audioUrl, piApiKey)
          console.log('[movie/generate] Shot', shot.shot, 'omni_task_id:', omniTaskId)
        }

        // Kling text-to-video for scene
        const klingTaskId = await submitKling(shot.scene, piApiKey)
        console.log('[movie/generate] Shot', shot.shot, 'kling_task_id:', klingTaskId)

        // Insert into omnihuman_jobs so the cron can poll OmniHuman for this shot
        if (omniTaskId) {
          try {
            const { error: omniInsertErr } = await supabase.from('omnihuman_jobs').insert({
              task_id: omniTaskId,
              status: 'processing',
              image_url: frameUrl,
              audio_url: audioUrl,
              scene_task_id: klingTaskId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            if (omniInsertErr) {
              console.error('[movie/generate] omnihuman_jobs insert failed for shot', shot.shot, ':', omniInsertErr.message)
            } else {
              console.log('[movie/generate] omnihuman_jobs insert SUCCESS for shot', shot.shot)
            }
          } catch (omniDbErr) {
            console.error('[movie/generate] omnihuman_jobs insert FATAL for shot', shot.shot, ':', omniDbErr instanceof Error ? omniDbErr.message : omniDbErr)
          }
        }

        // Insert into movie_shots
        try {
          const { error: insertErr } = await supabase.from('movie_shots').insert({
            movie_id: jobId,
            shot_index: shot.shot,
            omni_task_id: omniTaskId,
            kling_task_id: klingTaskId,
            audio_url: audioUrl,
            status: 'pending',
            created_at: new Date().toISOString(),
          })
          if (insertErr) {
            console.error('[movie/generate] movie_shots insert failed for shot', shot.shot, ':', insertErr.message)
          } else {
            console.log('[movie/generate] movie_shots insert SUCCESS for shot', shot.shot)
          }
        } catch (dbErr) {
          console.error('[movie/generate] movie_shots insert FATAL for shot', shot.shot, ':', dbErr instanceof Error ? dbErr.message : dbErr)
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
            model_id: 'eleven_turbo_v2',
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
