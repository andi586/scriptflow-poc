import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/orchestrator
 *
 * Unified state machine for the multi-shot movie pipeline.
 *
 * Step 1: Retry pending shots that are missing task IDs
 * Step 2: Poll submitted/processing shots → submit Shotstack merge when both ready
 * Step 3: Poll merging shots → mark done
 * Step 4: Assemble complete movies → submit final Shotstack render
 * Step 5: Poll rendering movies → mark final_complete
 * Step 6: Auto-recovery for stuck shots
 */

const CRON_BUDGET_MS = 50_000
const cronStart = Date.now()

function elapsed() { return Date.now() - cronStart }
function overBudget() { return elapsed() > CRON_BUDGET_MS }

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const piApiKey    = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  const elevenKey   = process.env.ELEVENLABS_API_KEY
  const shotstackKey = process.env.SHOTSTACK_API_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)
  const log: string[] = []

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Retry pending shots missing task IDs
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget()) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: pendingShots } = await db
      .from('movie_shots')
      .select('*')
      .eq('status', 'pending')
      .or(`omni_task_id.is.null,kling_task_id.is.null`)
      .or(`submitted_at.is.null,submitted_at.lt.${fiveMinAgo}`)
      .limit(10)

    log.push(`[step1] pending shots to retry: ${pendingShots?.length ?? 0}`)

    for (const shot of pendingShots ?? []) {
      if (overBudget()) break
      try {
        const retryCount = shot.retry_count ?? 0
        if (retryCount >= 3) {
          await db.from('movie_shots').update({ status: 'failed' }).eq('id', shot.id)
          log.push(`[step1] shot ${shot.id} exceeded retries → failed`)
          continue
        }

        let omniTaskId: string | null = shot.omni_task_id ?? null
        let klingTaskId: string | null = shot.kling_task_id ?? null

        // Face shots: TTS → OmniHuman
        if (shot.shot_type === 'face' && !omniTaskId && elevenKey && shot.audio_url) {
          // OmniHuman needs audio_url — if already stored, submit directly
          const omniRes = await fetch('https://api.piapi.ai/api/v1/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
            body: JSON.stringify({
              model: 'omni-human',
              task_type: 'omni-human-1.5',
              input: { image_url: shot.image_url ?? shot.frame_url, audio_url: shot.audio_url, prompt: 'person speaks naturally, cinematic' },
            }),
          })
          if (omniRes.ok) {
            const omniData = await omniRes.json()
            omniTaskId = omniData?.data?.task_id ?? omniData?.task_id ?? null
            log.push(`[step1] shot ${shot.id} re-submitted OmniHuman: ${omniTaskId}`)
          }
        }

        // All shots: Kling
        if (!klingTaskId) {
          const scenePrompt = shot.scene ?? 'empty cinematic scene, no people, no humans, dramatic lighting'
          const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
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
                duration: shot.duration ?? 5,
                aspect_ratio: '9:16',
                enable_audio: true,
              },
            }),
          })
          if (klingRes.ok) {
            const klingData = await klingRes.json()
            klingTaskId = klingData?.data?.task_id ?? null
            log.push(`[step1] shot ${shot.id} re-submitted Kling: ${klingTaskId}`)
          }
        }

        await db.from('movie_shots').update({
          omni_task_id: omniTaskId,
          kling_task_id: klingTaskId,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          retry_count: retryCount + 1,
        }).eq('id', shot.id)
      } catch (e) {
        log.push(`[step1] error for shot ${shot.id}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Poll submitted/processing shots
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget()) {
    const { data: activeShots } = await db
      .from('movie_shots')
      .select('*')
      .in('status', ['submitted', 'processing', 'pending', 'scene_only', 'omni_done', 'kling_done'])
      .is('shotstack_render_id', null)
      .limit(20)

    log.push(`[step2] active shots to poll: ${activeShots?.length ?? 0}`)

    for (const shot of activeShots ?? []) {
      if (overBudget()) break
      try {
        let omniVideoUrl: string | null = shot.omni_video_url ?? null
        let klingSceneUrl: string | null = shot.kling_scene_url ?? null

        // Check OmniHuman via omnihuman_jobs table
        if (shot.omni_task_id && !omniVideoUrl) {
          const { data: omniJob } = await db
            .from('omnihuman_jobs')
            .select('result_video_url, status')
            .eq('task_id', shot.omni_task_id)
            .single()
          if (omniJob?.result_video_url) {
            omniVideoUrl = omniJob.result_video_url
            await db.from('movie_shots').update({ omni_video_url: omniVideoUrl, status: 'omni_done' }).eq('id', shot.id)
            log.push(`[step2] shot ${shot.id} omni_done`)
          }
        }

        // Check Kling via PiAPI
        if (shot.kling_task_id && !klingSceneUrl) {
          const klingRes = await fetch(`https://api.piapi.ai/api/v1/task/${shot.kling_task_id}`, {
            headers: { 'x-api-key': piApiKey },
          })
          if (klingRes.ok) {
            const klingData = await klingRes.json()
            const klingStatus: string = klingData?.data?.status ?? 'unknown'
            if (klingStatus === 'completed' || klingStatus === 'success') {
              klingSceneUrl =
                klingData?.data?.output?.video?.resource_without_watermark ??
                klingData?.data?.output?.video_url ??
                klingData?.data?.output?.video ??
                klingData?.data?.output?.url ?? null
              if (klingSceneUrl) {
                await db.from('movie_shots').update({ kling_scene_url: klingSceneUrl, status: 'kling_done' }).eq('id', shot.id)
                log.push(`[step2] shot ${shot.id} kling_done`)
              }
            }
          }
        }

        // Scene-only shots: just kling needed
        const isSceneOnly = shot.shot_type === 'scene'
        const faceReady = omniVideoUrl && klingSceneUrl
        const sceneReady = isSceneOnly && klingSceneUrl

        if ((faceReady || sceneReady) && shotstackKey) {
          // Submit Shotstack per-shot merge
          const clips = isSceneOnly
            ? [{ asset: { type: 'video', src: klingSceneUrl }, start: 0, length: shot.duration ?? 5 }]
            : [
                { asset: { type: 'video', src: omniVideoUrl }, start: 0, length: shot.duration ?? 10 },
                { asset: { type: 'video', src: klingSceneUrl }, start: shot.duration ?? 10, length: shot.duration ?? 10 },
              ]

          const ssRes = await fetch('https://api.shotstack.io/stage/render', {
            method: 'POST',
            headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timeline: { tracks: [{ clips }] },
              output: { format: 'mp4', resolution: 'sd' },
            }),
          })
          if (ssRes.ok) {
            const ssData = await ssRes.json()
            const renderId: string | null = ssData?.response?.id ?? null
            if (renderId) {
              await db.from('movie_shots').update({ shotstack_render_id: renderId, status: 'merging' }).eq('id', shot.id)
              log.push(`[step2] shot ${shot.id} merging, renderId: ${renderId}`)
            } else {
              log.push(`[step2] shot ${shot.id} Shotstack no renderId: ${JSON.stringify(ssData?.response?.errors)}`)
            }
          }
        } else if (omniVideoUrl || klingSceneUrl) {
          await db.from('movie_shots').update({ status: 'processing' }).eq('id', shot.id)
        }
      } catch (e) {
        log.push(`[step2] error for shot ${shot.id}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Poll merging shots
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget() && shotstackKey) {
    const { data: mergingShots } = await db
      .from('movie_shots')
      .select('id, shotstack_render_id, retry_count, movie_id')
      .eq('status', 'merging')
      .not('shotstack_render_id', 'is', null)
      .limit(20)

    log.push(`[step3] merging shots to poll: ${mergingShots?.length ?? 0}`)

    for (const shot of mergingShots ?? []) {
      if (overBudget()) break
      try {
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${shot.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (!pollRes.ok) continue
        const pollData = await pollRes.json()
        const renderStatus: string = pollData?.response?.status ?? 'unknown'
        log.push(`[step3] shot ${shot.id} render status: ${renderStatus}`)

        if (renderStatus === 'done') {
          const finalUrl: string | null = pollData?.response?.url ?? null
          if (finalUrl) {
            await db.from('movie_shots').update({ final_shot_url: finalUrl, status: 'shot_complete', shotstack_render_id: null }).eq('id', shot.id)
            log.push(`[step3] shot ${shot.id} shot_complete: ${finalUrl}`)
          }
        } else if (renderStatus === 'failed') {
          const retryCount = (shot.retry_count ?? 0) + 1
          if (retryCount >= 3) {
            await db.from('movie_shots').update({ status: 'failed', shotstack_render_id: null }).eq('id', shot.id)
            log.push(`[step3] shot ${shot.id} failed after ${retryCount} retries`)
          } else {
            await db.from('movie_shots').update({ status: 'pending', shotstack_render_id: null, retry_count: retryCount }).eq('id', shot.id)
            log.push(`[step3] shot ${shot.id} render failed, reset to pending (retry ${retryCount})`)
          }
        }
      } catch (e) {
        log.push(`[step3] error for shot ${shot.id}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Assemble complete movies
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget() && shotstackKey) {
    // Find movies with at least one shot_complete
    const { data: shotCompleteRows } = await db
      .from('movie_shots')
      .select('movie_id')
      .eq('status', 'shot_complete')

    const candidateMovieIds = [...new Set((shotCompleteRows ?? []).map((r: { movie_id: string }) => r.movie_id))]
    log.push(`[step4] candidate movies: ${candidateMovieIds.length}`)

    for (const movieId of candidateMovieIds) {
      if (overBudget()) break
      try {
        // Skip if already rendering or final_complete
        const { data: doneCheck } = await db
          .from('movie_shots')
          .select('id')
          .eq('movie_id', movieId)
          .in('status', ['final_complete'])
          .limit(1)
        if (doneCheck && doneCheck.length > 0) continue

        const { data: renderingCheck } = await db
          .from('omnihuman_jobs')
          .select('id')
          .eq('task_id', movieId)
          .eq('status', 'rendering')
          .limit(1)
        if (renderingCheck && renderingCheck.length > 0) continue

        // Get all shots for this movie
        const { data: allShots } = await db
          .from('movie_shots')
          .select('status, final_shot_url, shot_index, duration')
          .eq('movie_id', movieId)
          .order('shot_index', { ascending: true })

        if (!allShots || allShots.length === 0) continue

        // All shots must be shot_complete or failed (no pending/processing/merging)
        const hasInProgress = allShots.some((s: { status: string }) =>
          ['pending', 'submitted', 'processing', 'merging', 'scene_only', 'omni_done', 'kling_done'].includes(s.status)
        )
        if (hasInProgress) {
          log.push(`[step4] movie ${movieId} still has in-progress shots, skipping`)
          continue
        }

        const shotsWithUrl = allShots.filter((s: { final_shot_url: string | null }) => s.final_shot_url)
        if (shotsWithUrl.length === 0) continue

        log.push(`[step4] movie ${movieId} ready for assembly: ${shotsWithUrl.length} shots`)

        // Build sequential Shotstack timeline
        const clips = shotsWithUrl.map((s: { final_shot_url: string | null; duration?: number }, i: number) => {
          let start = 0
          for (let j = 0; j < i; j++) {
            start += (shotsWithUrl[j] as { duration?: number }).duration ?? 10
          }
          return { asset: { type: 'video', src: s.final_shot_url }, start, length: s.duration ?? 10 }
        })

        const ssRes = await fetch('https://api.shotstack.io/stage/render', {
          method: 'POST',
          headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeline: { tracks: [{ clips }] }, output: { format: 'mp4', resolution: 'sd' } }),
        })

        if (ssRes.ok) {
          const ssData = await ssRes.json()
          log.push(`[step4] Shotstack errors: ${JSON.stringify(ssData?.response?.errors)}`)
          const renderId: string | null = ssData?.response?.id ?? null
          if (renderId) {
            // Upsert into omnihuman_jobs
            const { data: existingJob } = await db.from('omnihuman_jobs').select('id').eq('task_id', movieId).single()
            if (existingJob) {
              await db.from('omnihuman_jobs').update({ shotstack_render_id: renderId, status: 'rendering', updated_at: new Date().toISOString() }).eq('task_id', movieId)
            } else {
              await db.from('omnihuman_jobs').insert({ task_id: movieId, shotstack_render_id: renderId, status: 'rendering', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            }
            log.push(`[step4] movie ${movieId} final render submitted: ${renderId}`)
          }
        }
      } catch (e) {
        log.push(`[step4] error for movie ${movieId}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: Poll rendering movies
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget() && shotstackKey) {
    const { data: renderingJobs } = await db
      .from('omnihuman_jobs')
      .select('id, task_id, shotstack_render_id')
      .eq('status', 'rendering')
      .not('shotstack_render_id', 'is', null)
      .limit(5)

    log.push(`[step5] rendering jobs to poll: ${renderingJobs?.length ?? 0}`)

    for (const job of renderingJobs ?? []) {
      if (overBudget()) break
      try {
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${job.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (!pollRes.ok) continue
        const pollData = await pollRes.json()
        const renderStatus: string = pollData?.response?.status ?? 'unknown'
        log.push(`[step5] movie ${job.task_id} render status: ${renderStatus}`)

        if (renderStatus === 'done') {
          const finalUrl: string | null = pollData?.response?.url ?? null
          if (finalUrl) {
            await db.from('omnihuman_jobs').update({ result_video_url: finalUrl, status: 'completed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
            await db.from('movie_shots').update({ status: 'final_complete' }).eq('movie_id', job.task_id)
            log.push(`[step5] movie ${job.task_id} final_complete: ${finalUrl}`)
          }
        } else if (renderStatus === 'failed') {
          await db.from('omnihuman_jobs').update({ status: 'failed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
          log.push(`[step5] movie ${job.task_id} final render failed`)
        }
      } catch (e) {
        log.push(`[step5] error for job ${job.id}: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6: Auto-recovery for stuck shots
  // ══════════════════════════════════════════════════════════════════════════
  if (!overBudget()) {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

    // Stuck submitted shots
    const { data: stuckSubmitted } = await db
      .from('movie_shots')
      .select('id')
      .eq('status', 'submitted')
      .lt('submitted_at', tenMinAgo)
      .limit(10)

    if (stuckSubmitted && stuckSubmitted.length > 0) {
      await db.from('movie_shots')
        .update({ status: 'pending', omni_task_id: null, kling_task_id: null })
        .in('id', stuckSubmitted.map((s: { id: string }) => s.id))
      log.push(`[step6] reset ${stuckSubmitted.length} stuck submitted shots`)
    }

    // Stuck processing shots
    const { data: stuckProcessing } = await db
      .from('movie_shots')
      .select('id')
      .eq('status', 'processing')
      .lt('updated_at', fifteenMinAgo)
      .limit(10)

    if (stuckProcessing && stuckProcessing.length > 0) {
      await db.from('movie_shots')
        .update({ status: 'pending' })
        .in('id', stuckProcessing.map((s: { id: string }) => s.id))
      log.push(`[step6] reset ${stuckProcessing.length} stuck processing shots`)
    }
  }

  return NextResponse.json({ elapsed: elapsed(), log })
}
