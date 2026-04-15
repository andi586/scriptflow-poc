import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/process-movies
 *
 * Dedicated cron for the multi-shot movie pipeline (movie_shots table).
 * Runs every minute independently of process-kling.
 *
 * 1. Query all movie_shots with status IN ('pending', 'scene_only', 'omni_done', 'kling_done', 'processing')
 * 2. For scene_only shots: poll Kling only → shot_complete
 * 3. For face shots: poll OmniHuman + Kling → Shotstack merge → shot_complete
 * 4. When all shots in a movie are shot_complete → concat final movie
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const piApiKey    = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)
  const railwayUrl = process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'
  const shotstackKey = process.env.SHOTSTACK_API_KEY

  const cronStart = Date.now()
  const CRON_BUDGET_MS = 45000

  // ── Process ALL pending movie_shots in parallel ───────────────────────────
  const { data: pendingShots } = await supabaseAdmin
    .from('movie_shots')
    .select('*')
    .in('status', ['pending', 'processing', 'omni_done', 'kling_done', 'scene_only'])
    .limit(20)

  console.log(`[cron/process-movies] Found ${pendingShots?.length ?? 0} pending movie_shots`)

  await Promise.allSettled((pendingShots ?? []).map(async (shot) => {
    try {
      let omniVideoUrl: string | null = shot.omni_video_url ?? null
      let klingSceneUrl: string | null = shot.kling_scene_url ?? null
      let shotStatus: string = shot.status

      // ── SCENE-ONLY SHOT ──────────────────────────────────────────────
      if (shot.shot_type === 'scene' && shot.status === 'scene_only') {
        console.log('[cron/process-movies] Processing scene_only shot:', shot.id, 'kling_task_id:', shot.kling_task_id)
        if (shot.kling_task_id && !shot.final_shot_url) {
          const klingRes = await fetch(`https://api.piapi.ai/api/v1/task/${shot.kling_task_id}`, {
            headers: { 'x-api-key': piApiKey },
          })
          if (klingRes.ok) {
            const klingData = await klingRes.json()
            const klingStatus: string = klingData?.data?.status ?? klingData?.status ?? 'unknown'
            console.log(`[cron/process-movies] scene-only shot ${shot.id} kling status=${klingStatus}`)
            if (klingStatus === 'completed' || klingStatus === 'success') {
              const sceneUrl: string | null =
                klingData?.data?.output?.video?.resource_without_watermark ??
                klingData?.data?.output?.video_url ??
                klingData?.data?.output?.video ??
                klingData?.data?.output?.url ??
                null
              if (sceneUrl) {
                await supabaseAdmin.from('movie_shots').update({
                  kling_scene_url: sceneUrl,
                  final_shot_url: sceneUrl,
                  status: 'shot_complete',
                }).eq('id', shot.id)
                console.log(`[cron/process-movies] scene-only shot ${shot.id} shot_complete: ${sceneUrl}`)
              } else {
                console.warn(`[cron/process-movies] scene-only shot ${shot.id} kling completed but no video url`)
              }
            }
          } else {
            console.warn(`[cron/process-movies] scene-only shot ${shot.id} kling poll failed: ${klingRes.status}`)
          }
        } else if (!shot.kling_task_id) {
          // Re-submit Kling task for this scene_only shot
          console.log(`[cron/process-movies] scene-only shot ${shot.id} has no kling_task_id, re-submitting Kling...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          try {
            const scenePrompt = shot.scene ?? 'empty cinematic scene, no people, no humans, dramatic lighting'
            const klingSubmitRes = await fetch('https://api.piapi.ai/api/v1/task', {
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
            if (klingSubmitRes.ok) {
              const klingSubmitData = await klingSubmitRes.json()
              const newKlingTaskId: string | null = klingSubmitData?.data?.task_id ?? null
              if (newKlingTaskId) {
                await supabaseAdmin.from('movie_shots').update({ kling_task_id: newKlingTaskId }).eq('id', shot.id)
                console.log(`[cron/process-movies] scene-only shot ${shot.id} re-submitted Kling: ${newKlingTaskId}`)
              }
            } else {
              console.warn(`[cron/process-movies] scene-only shot ${shot.id} Kling re-submit failed: ${klingSubmitRes.status}`)
            }
          } catch (resubErr) {
            console.warn(`[cron/process-movies] scene-only shot ${shot.id} Kling re-submit error:`, resubErr instanceof Error ? resubErr.message : resubErr)
          }
        }
        return
      }

      // ── FACE SHOT: Check OmniHuman ───────────────────────────────────
      if (shot.omni_task_id && !omniVideoUrl) {
        const { data: omniJob } = await supabaseAdmin
          .from('omnihuman_jobs')
          .select('status, result_video_url')
          .eq('task_id', shot.omni_task_id)
          .single()
        console.log(`[cron/process-movies] shot ${shot.id} omni lookup: status=${omniJob?.status}`)
        if (omniJob?.result_video_url) {
          omniVideoUrl = omniJob.result_video_url
          shotStatus = 'omni_done'
          await supabaseAdmin.from('movie_shots').update({ omni_video_url: omniVideoUrl, status: 'omni_done' }).eq('id', shot.id)
          console.log(`[cron/process-movies] shot ${shot.id} omni_done`)
        }
      }

      // ── FACE SHOT: Check Kling scene ─────────────────────────────────
      if (shot.kling_task_id && !klingSceneUrl) {
        const klingRes = await fetch(`https://api.piapi.ai/api/v1/task/${shot.kling_task_id}`, {
          headers: { 'x-api-key': piApiKey },
        })
        if (klingRes.ok) {
          const klingData = await klingRes.json()
          const klingStatus: string = klingData?.data?.status ?? klingData?.status ?? 'unknown'
          if (klingStatus === 'completed' || klingStatus === 'success') {
            const sceneUrl: string | null =
              klingData?.data?.output?.video?.resource_without_watermark ??
              klingData?.data?.output?.video_url ??
              klingData?.data?.output?.video ??
              klingData?.data?.output?.url ??
              null
            if (sceneUrl) {
              klingSceneUrl = sceneUrl
              shotStatus = 'kling_done'
              await supabaseAdmin.from('movie_shots').update({ kling_scene_url: klingSceneUrl, status: 'kling_done' }).eq('id', shot.id)
              console.log(`[cron/process-movies] shot ${shot.id} kling_done: ${klingSceneUrl}`)
            }
          }
        }
      }

      // ── Poll existing Shotstack render ───────────────────────────────
      if (shot.shotstack_render_id && !shot.final_shot_url && shotstackKey) {
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${shot.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          const renderStatus: string = pollData?.response?.status ?? 'unknown'
          console.log(`[cron/process-movies] shot ${shot.id} Shotstack render status=${renderStatus}`)
          if (renderStatus === 'done') {
            const finalShotUrl: string | null = pollData?.response?.url ?? null
            if (finalShotUrl) {
              await supabaseAdmin.from('movie_shots').update({ final_shot_url: finalShotUrl, status: 'shot_complete' }).eq('id', shot.id)
              shotStatus = 'shot_complete'
              console.log(`[cron/process-movies] shot ${shot.id} shot_complete: ${finalShotUrl}`)
            }
          } else if (renderStatus === 'failed') {
            await supabaseAdmin.from('movie_shots').update({ shotstack_render_id: null }).eq('id', shot.id)
            console.warn(`[cron/process-movies] shot ${shot.id} Shotstack render failed, cleared`)
          }
        }
        return
      }

      // ── Both ready → submit Shotstack or Railway ─────────────────────
      if (omniVideoUrl && klingSceneUrl && !shot.final_shot_url && !shot.shotstack_render_id) {
        if (shotstackKey) {
          fetch('https://api.shotstack.io/stage/render', {
            method: 'POST',
            headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timeline: {
                tracks: [{ clips: [
                  { asset: { type: 'video', src: omniVideoUrl }, start: 0, length: 10, transition: { out: 'fade' } },
                  { asset: { type: 'video', src: klingSceneUrl }, start: 10, length: 10, transition: { in: 'fade' } },
                ]}],
              },
              output: { format: 'mp4', resolution: 'sd', aspectRatio: '9:16' },
            }),
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              const renderId: string | null = data?.response?.id ?? null
              if (renderId) {
                await supabaseAdmin.from('movie_shots').update({ shotstack_render_id: renderId, status: 'processing' }).eq('id', shot.id)
                console.log(`[cron/process-movies] shot ${shot.id} Shotstack render submitted: ${renderId}`)
              }
            }
          }).catch((e) => console.warn(`[cron/process-movies] shot ${shot.id} Shotstack error:`, e instanceof Error ? e.message : e))
        } else {
          fetch(`${railwayUrl}/concat-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneVideoUrl: klingSceneUrl, faceVideoUrl: omniVideoUrl }),
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              if (data.outputUrl) {
                await supabaseAdmin.from('movie_shots').update({ final_shot_url: data.outputUrl, status: 'shot_complete' }).eq('id', shot.id)
                console.log(`[cron/process-movies] shot ${shot.id} shot_complete via Railway: ${data.outputUrl}`)
              }
            }
          }).catch((e) => console.warn(`[cron/process-movies] shot ${shot.id} Railway error:`, e instanceof Error ? e.message : e))
        }
      }

      void shotStatus
    } catch (shotErr) {
      console.warn(`[cron/process-movies] error for shot ${shot.id}:`, shotErr instanceof Error ? shotErr.message : shotErr)
    }
  }))

  // ── Find movies where all shots are shot_complete → concat final movie ────
  const { data: shotCompleteRows } = await supabaseAdmin
    .from('movie_shots')
    .select('movie_id')
    .eq('status', 'shot_complete')

  if (!shotCompleteRows || shotCompleteRows.length === 0) {
    console.log('[cron/process-movies] No shot_complete movies found')
    return NextResponse.json({ processed: pendingShots?.length ?? 0, elapsed: Date.now() - cronStart })
  }

  const movieIds = [...new Set(shotCompleteRows.map((r: { movie_id: string }) => r.movie_id))]
  console.log(`[cron/process-movies] Found ${movieIds.length} movies with at least one shot_complete`)

  for (const movieId of movieIds) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) break
    try {
      // Check if already has final_complete shots (already processed)
      const { data: doneShots } = await supabaseAdmin
        .from('movie_shots')
        .select('id')
        .eq('movie_id', movieId)
        .eq('status', 'final_complete')
        .limit(1)

      if (doneShots && doneShots.length > 0) {
        console.log(`[cron/process-movies] movie ${movieId} already final_complete, skipping`)
        continue
      }

      // Check if ALL shots are shot_complete
      const { data: allShots } = await supabaseAdmin
        .from('movie_shots')
        .select('status, final_shot_url, shot_index, duration')
        .eq('movie_id', movieId)
        .order('shot_index', { ascending: true })

      if (!allShots || allShots.length === 0) continue

      const allComplete = allShots.every((s: { status: string; final_shot_url: string | null }) =>
        s.status === 'shot_complete' && s.final_shot_url
      )

      if (!allComplete) {
        const completeCount = allShots.filter((s: { status: string }) => s.status === 'shot_complete').length
        console.log(`[cron/process-movies] movie ${movieId}: ${completeCount}/${allShots.length} shots complete, waiting...`)
        continue
      }

      console.log(`[cron/process-movies] All shots complete for movie: ${movieId}, starting final concat...`)

      // Step 3: Get all final_shot_urls in order
      const shotUrls: string[] = allShots
        .map((s: { final_shot_url: string | null }) => s.final_shot_url)
        .filter(Boolean) as string[]

      console.log(`[cron/process-movies] Concatenating ${shotUrls.length} shots for movie ${movieId}`)

      // Step 4: Submit to Shotstack for final assembly
      ;(async () => {
        try {
          // Build Shotstack timeline (1s overlap between clips)
          let currentTime = 0
          const clips = shotUrls.map((url, i) => {
            const duration = (allShots[i] as { duration?: number })?.duration ?? 10
            const clip: Record<string, unknown> = {
              asset: { type: 'video', src: url },
              start: currentTime,
              length: duration,
            }
            if (i > 0) clip.transition = { in: 'fadeIn', out: 'fadeOut' }
            currentTime += (duration - 1) // 1 second overlap between clips
            return clip
          })

          const shotstackRes = await fetch('https://api.shotstack.io/stage/render', {
            method: 'POST',
            headers: {
              'x-api-key': shotstackKey!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timeline: { tracks: [{ clips }] },
              output: { format: 'mp4', resolution: 'sd', aspectRatio: '9:16' },
            }),
          })

          const shotstackData = await shotstackRes.json()
          const renderId: string | null = shotstackData?.response?.id ?? null
          console.log(`[cron/process-movies] Shotstack renderId for movie ${movieId}:`, renderId)

          if (!renderId) {
            console.warn(`[cron/process-movies] Shotstack submit failed for movie ${movieId}:`, shotstackData)
            return
          }

          // Store render ID in omnihuman_jobs so the Shotstack poll section picks it up
          const { data: existingJob } = await supabaseAdmin
            .from('omnihuman_jobs')
            .select('id')
            .eq('task_id', movieId)
            .single()

          if (existingJob) {
            await supabaseAdmin.from('omnihuman_jobs').update({
              shotstack_render_id: renderId,
              status: 'rendering',
              updated_at: new Date().toISOString(),
            }).eq('task_id', movieId)
          } else {
            await supabaseAdmin.from('omnihuman_jobs').insert({
              task_id: movieId,
              shotstack_render_id: renderId,
              status: 'rendering',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }

          console.log(`[cron/process-movies] Shotstack render submitted for movie ${movieId}: ${renderId}`)
        } catch (concatErr) {
          console.warn(`[cron/process-movies] Shotstack final concat error for movie ${movieId}:`, concatErr instanceof Error ? concatErr.message : concatErr)
        }
      })()
    } catch (movieErr) {
      console.warn(`[cron/process-movies] final concat error for movie ${movieId}:`, movieErr instanceof Error ? movieErr.message : movieErr)
    }
  }

  // ── Poll pending final-movie Shotstack renders ────────────────────────────
  if (Date.now() - cronStart <= CRON_BUDGET_MS && shotstackKey) {
    const { data: renderingJobs } = await supabaseAdmin
      .from('omnihuman_jobs')
      .select('id, task_id, shotstack_render_id')
      .eq('status', 'rendering')
      .not('shotstack_render_id', 'is', null)
      .limit(5)

    for (const job of renderingJobs ?? []) {
      if (Date.now() - cronStart > CRON_BUDGET_MS) break
      try {
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${job.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (!pollRes.ok) continue
        const pollData = await pollRes.json()
        const renderStatus: string = pollData?.response?.status ?? 'unknown'
        console.log(`[cron/process-movies] Final render ${job.shotstack_render_id} status=${renderStatus} for movie ${job.task_id}`)
        if (renderStatus === 'done') {
          const finalMovieUrl: string | null = pollData?.response?.url ?? null
          if (finalMovieUrl) {
            await supabaseAdmin.from('omnihuman_jobs').update({ result_video_url: finalMovieUrl, status: 'completed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
            await supabaseAdmin.from('movie_shots').update({ status: 'final_complete' }).eq('movie_id', job.task_id)
            console.log(`[cron/process-movies] Final movie complete for ${job.task_id}: ${finalMovieUrl}`)
          }
        } else if (renderStatus === 'failed') {
          await supabaseAdmin.from('omnihuman_jobs').update({ status: 'failed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
          console.warn(`[cron/process-movies] Final render failed for movie ${job.task_id}`)
        }
      } catch (pollErr) {
        console.warn(`[cron/process-movies] final render poll error for job ${job.id}:`, pollErr instanceof Error ? pollErr.message : pollErr)
      }
    }
  }

  return NextResponse.json({
    processed: pendingShots?.length ?? 0,
    elapsed: Date.now() - cronStart,
  })
}
