import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/process-kling
 *
 * Server-side cron job (runs every minute via vercel.json).
 * Polls PiAPI for all omnihuman_jobs with status='kling_processing'
 * and updates the DB when Kling completes or fails.
 *
 * This ensures Kling tasks complete even if the user leaves the page.
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
  const shotstackKey = process.env.SHOTSTACK_API_KEY

  const cronStart = Date.now()
  const CRON_BUDGET_MS = 45000 // 45 seconds max

  // ════════════════════════════════════════════════════════════════════════
  // Step 0 (original): Poll scene_task_id for omnihuman_jobs
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Step 0, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 0 })
  }

  const { data: sceneJobs } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('*')
    .not('scene_task_id', 'is', null)
    .is('scene_video_url', null)
    .not('status', 'eq', 'failed')

  console.log(`[cron/process-kling] Found ${sceneJobs?.length ?? 0} jobs with pending scene_task_id`)

  for (const job of sceneJobs ?? []) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) { console.log('[cron] Budget exceeded in scene loop, stopping'); break }
    try {
      const sceneRes = await fetch(`https://api.piapi.ai/api/v1/task/${job.scene_task_id}`, {
        headers: { 'x-api-key': piApiKey },
      })
      if (!sceneRes.ok) { console.warn(`[cron/process-kling] Scene poll failed for job ${job.id}: ${sceneRes.status}`); continue }
      const sceneData = await sceneRes.json()
      const sceneStatus: string = sceneData?.data?.status ?? sceneData?.status ?? 'unknown'
      const sceneVideoUrl: string | null =
        sceneData?.data?.output?.video_url ??
        sceneData?.data?.output?.video ??
        sceneData?.data?.output?.url ??
        null
      console.log(`[cron/process-kling] scene job ${job.id} status=${sceneStatus} url=${sceneVideoUrl}`)

      if ((sceneStatus === 'completed' || sceneStatus === 'success') && sceneVideoUrl) {
        await supabaseAdmin.from('omnihuman_jobs').update({ scene_video_url: sceneVideoUrl, updated_at: new Date().toISOString() }).eq('id', job.id)
        console.log(`[cron/process-kling] scene_video_url stored for job ${job.id}`)

        const { data: freshJob } = await supabaseAdmin.from('omnihuman_jobs').select('result_video_url').eq('id', job.id).single()
        if (freshJob?.result_video_url) {
          try {
            const concatRes = await fetch(`${railwayUrl}/concat-videos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sceneVideoUrl, faceVideoUrl: freshJob.result_video_url }),
            })
            if (concatRes.ok) {
              const concatData = await concatRes.json()
              const finalUrl = concatData.outputUrl ?? freshJob.result_video_url
              await supabaseAdmin.from('omnihuman_jobs').update({ result_video_url: finalUrl, status: 'completed', updated_at: new Date().toISOString() }).eq('id', job.id)
              console.log(`[cron/process-kling] Concat done for job ${job.id}: ${finalUrl}`)
            }
          } catch (concatErr) {
            console.warn(`[cron/process-kling] concat error for job ${job.id}:`, concatErr instanceof Error ? concatErr.message : concatErr)
          }
        }
      } else if (sceneStatus === 'failed' || sceneStatus === 'error') {
        await supabaseAdmin.from('omnihuman_jobs').update({ scene_task_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
      }
    } catch (err) {
      console.warn(`[cron/process-kling] scene poll error for job ${job.id}:`, err instanceof Error ? err.message : err)
    }
  }

  // ── Step 1: Check OmniHuman pending/processing jobs ───────────────────────
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Step 1, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 1 })
  }

  const { data: pendingJobs } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .is('kling_task_id', null)

  console.log(`[cron/process-kling] Found ${pendingJobs?.length ?? 0} OmniHuman pending/processing jobs`)

  let omniCompleted = 0
  let omniStillPending = 0

  for (const job of pendingJobs ?? []) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) { console.log('[cron] Budget exceeded in omni loop, stopping'); break }
    try {
      console.log(`[cron/process-kling] Polling OmniHuman for job ${job.id}, task_id=${job.task_id}`)
      const omniRes = await fetch(`https://api.piapi.ai/api/v1/task/${job.task_id}`, {
        headers: { 'x-api-key': piApiKey },
      })

      if (!omniRes.ok) {
        console.warn(`[cron/process-kling] OmniHuman poll failed for job ${job.id}: ${omniRes.status}`)
        omniStillPending++
        continue
      }

      const omniData = await omniRes.json()
      const omniStatus: string = omniData?.data?.status ?? omniData?.status ?? 'unknown'
      const omniVideoUrl: string | null =
        omniData?.data?.output?.video ??
        omniData?.data?.output?.video_url ??
        omniData?.data?.output?.url ??
        null

      console.log(`[cron/process-kling] OmniHuman job ${job.id} status=${omniStatus} videoUrl=${omniVideoUrl}`)

      if ((omniStatus === 'completed' || omniStatus === 'success') && omniVideoUrl) {
        await supabaseAdmin
          .from('omnihuman_jobs')
          .update({ status: 'kling_pending', result_video_url: omniVideoUrl, updated_at: new Date().toISOString() })
          .eq('id', job.id)

        if (job.image_url) {
          try {
            const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
              body: JSON.stringify({
                model: 'kling',
                task_type: 'video_generation',
                input: {
                  prompt: 'cinematic close-up portrait, dramatic lighting, film noir, speaking naturally, emotional expression, ultra realistic',
                  negative_prompt: 'cartoon, anime, blur, distorted',
                  aspect_ratio: '9:16',
                  duration: 5,
                  version: '1.6',
                  mode: 'pro',
                  elements: [{ image_url: job.image_url }],
                },
              }),
            })
            if (klingRes.ok) {
              const klingData = await klingRes.json()
              const klingTaskId: string | null = klingData?.data?.task_id ?? null
              if (klingTaskId) {
                await supabaseAdmin
                  .from('omnihuman_jobs')
                  .update({ kling_task_id: klingTaskId, status: 'kling_processing', updated_at: new Date().toISOString() })
                  .eq('id', job.id)
                omniCompleted++
              }
            } else {
              console.error(`[cron/process-kling] Kling submit FAILED for job ${job.id}:`, await klingRes.text())
            }
          } catch (klingErr) {
            console.warn(`[cron/process-kling] Kling submit error for job ${job.id}:`, klingErr instanceof Error ? klingErr.message : klingErr)
          }
        } else {
          omniStillPending++
        }
      } else if (omniStatus === 'failed' || omniStatus === 'error') {
        await supabaseAdmin.from('omnihuman_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.id)
      } else {
        omniStillPending++
      }
    } catch (err) {
      console.error(`[cron/process-kling] Error checking OmniHuman job ${job.id}:`, err instanceof Error ? err.message : err)
      omniStillPending++
    }
  }

  console.log(`[cron/process-kling] OmniHuman check done: ${omniCompleted} submitted to Kling, ${omniStillPending} still pending`)

  // ── Step 2: Find all jobs waiting on Kling ────────────────────────────────
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Step 2, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 2 })
  }

  const { data: jobs, error: fetchErr } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('*')
    .eq('status', 'kling_processing')
    .not('kling_task_id', 'is', null)

  if (fetchErr) {
    console.error('[cron/process-kling] DB fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  console.log(`[cron/process-kling] Found ${jobs?.length ?? 0} Kling jobs to process`)

  let completed = 0
  let failed = 0
  let pending = 0

  for (const job of jobs ?? []) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) { console.log('[cron] Budget exceeded in kling loop, stopping'); break }
    try {
      const res = await fetch(`https://api.piapi.ai/api/v1/task/${job.kling_task_id}`, {
        headers: { 'x-api-key': piApiKey },
      })

      if (!res.ok) {
        console.warn(`[cron/process-kling] PiAPI poll failed for job ${job.id}: ${res.status}`)
        pending++
        continue
      }

      const data = await res.json()
      const status: string = data?.data?.status ?? data?.status ?? 'unknown'
      console.log(`[cron/process-kling] job ${job.id} klingTaskId=${job.kling_task_id} status=${status}`)

      if (status === 'completed' || status === 'success') {
        const klingVideoUrl: string | null =
          data?.data?.output?.video_url ??
          data?.data?.output?.video ??
          data?.data?.output?.url ??
          null

        if (klingVideoUrl) {
          let finalVideoUrl = klingVideoUrl
          const audioUrl: string | null = job.audio_url ?? null
          if (audioUrl) {
            try {
              const mergeRes = await fetch(`${railwayUrl}/merge-audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: klingVideoUrl, audioUrl }),
              })
              if (mergeRes.ok) {
                const mergeData = await mergeRes.json()
                finalVideoUrl = mergeData.outputUrl ?? klingVideoUrl
              }
            } catch (mergeErr) {
              console.warn(`[cron/process-kling] merge-audio error for job ${job.id}:`, mergeErr instanceof Error ? mergeErr.message : mergeErr)
            }
          }

          const { data: jobData } = await supabaseAdmin.from('omnihuman_jobs').select('scene_video_url').eq('id', job.id).single()

          if (jobData?.scene_video_url) {
            if (shotstackKey) {
              try {
                const shotstackRes = await fetch('https://api.shotstack.io/stage/render', {
                  method: 'POST',
                  headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    timeline: {
                      tracks: [{ clips: [
                        { asset: { type: 'video', src: finalVideoUrl }, start: 0, length: 10, transition: { out: 'fade' } },
                        { asset: { type: 'video', src: jobData.scene_video_url }, start: 10, length: 10, transition: { in: 'fade' } },
                      ]}],
                    },
                    output: { format: 'mp4', resolution: 'sd', aspectRatio: '9:16' },
                  }),
                })
                const shotstackData = await shotstackRes.json()
                const renderId: string | null = shotstackData?.response?.id ?? null
                if (renderId) {
                  // Store renderId for polling in next tick
                  await supabaseAdmin.from('omnihuman_jobs').update({
                    shotstack_render_id: renderId,
                    status: 'rendering',
                    result_video_url: finalVideoUrl,
                    updated_at: new Date().toISOString(),
                  }).eq('id', job.id)
                  console.log(`[cron/process-kling] Shotstack render submitted for job ${job.id}: ${renderId}`)
                  completed++
                  continue
                }
              } catch (shotstackErr) {
                console.warn(`[cron/process-kling] Shotstack error:`, shotstackErr instanceof Error ? shotstackErr.message : shotstackErr)
              }
            } else {
              const concatRes = await fetch(`${railwayUrl}/concat-videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sceneVideoUrl: jobData.scene_video_url, faceVideoUrl: finalVideoUrl }),
              })
              if (concatRes.ok) {
                const concatData = await concatRes.json()
                if (concatData.outputUrl) finalVideoUrl = concatData.outputUrl
              }
            }
          }

          await supabaseAdmin.from('omnihuman_jobs').update({
            status: 'completed',
            result_video_url: finalVideoUrl,
            updated_at: new Date().toISOString(),
          }).eq('id', job.id)
          console.log(`[cron/process-kling] job ${job.id} completed: ${finalVideoUrl}`)
          completed++

          try {
            await fetch(`${baseUrl}/api/push/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: job.task_id, videoUrl: finalVideoUrl }),
            })
          } catch {}
        } else {
          pending++
        }
      } else if (status === 'failed' || status === 'error') {
        await supabaseAdmin.from('omnihuman_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.id)
        failed++
      } else {
        pending++
      }
    } catch (err) {
      console.error(`[cron/process-kling] Error processing job ${job.id}:`, err instanceof Error ? err.message : err)
      pending++
    }
  }

  // ── Step 3: Catch-all concat sweep (1 job per tick) ───────────────────────
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Step 3, stopping early')
    return NextResponse.json({ processed: jobs?.length ?? 0, completed, failed, pending, stopped: 'budget_exceeded' })
  }

  const { data: concatJobs } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('*')
    .not('scene_video_url', 'is', null)
    .not('result_video_url', 'is', null)
    .not('result_video_url', 'like', '%concat%')
    .not('result_video_url', 'like', '%shotstack%')
    .limit(1) // Only 1 per cron tick

  console.log(`[cron/process-kling] Found ${concatJobs?.length ?? 0} jobs needing catch-all concat`)

  let concatCount = 0
  for (const job of concatJobs ?? []) {
    try {
      console.log(`[cron/process-kling] Catch-all concat for job ${job.id}...`)
      const concatRes = await fetch(`${railwayUrl}/concat-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneVideoUrl: job.scene_video_url, faceVideoUrl: job.result_video_url }),
      })
      if (concatRes.ok) {
        const concatData = await concatRes.json()
        if (concatData.outputUrl) {
          await supabaseAdmin.from('omnihuman_jobs').update({ result_video_url: concatData.outputUrl, updated_at: new Date().toISOString() }).eq('id', job.id)
          console.log(`[cron/process-kling] Catch-all concat done for job ${job.id}: ${concatData.outputUrl}`)
          concatCount++
        }
      }
    } catch (concatErr) {
      console.warn(`[cron/process-kling] Catch-all concat error for job ${job.id}:`, concatErr instanceof Error ? concatErr.message : concatErr)
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 4 (last): Process movie_shots table (multi-shot pipeline)
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before movie_shots step, stopping early')
    return NextResponse.json({ processed: jobs?.length ?? 0, completed, failed, pending, concatSweep: concatCount, stopped: 'budget_exceeded' })
  }

  // ── Process ALL pending movie_shots in parallel (non-blocking per shot) ───
  const { data: pendingShots } = await supabaseAdmin
    .from('movie_shots')
    .select('*')
    .in('status', ['pending', 'processing', 'omni_done', 'kling_done'])
    .limit(20) // Process all pending shots per tick

  console.log(`[cron/process-kling] Found ${pendingShots?.length ?? 0} pending movie_shots`)

  // Run all shot operations in parallel — each must complete in < 2s
  await Promise.allSettled((pendingShots ?? []).map(async (shot) => {
    try {
      // Track local state changes for this shot
      let omniVideoUrl: string | null = shot.omni_video_url ?? null
      let klingSceneUrl: string | null = shot.kling_scene_url ?? null
      let shotStatus: string = shot.status

      // ── Check OmniHuman via omnihuman_jobs (DB lookup, fast) ─────────
      if (shot.omni_task_id && !omniVideoUrl) {
        const { data: omniJob } = await supabaseAdmin
          .from('omnihuman_jobs')
          .select('status, result_video_url')
          .eq('task_id', shot.omni_task_id)
          .single()
        console.log(`[cron/movie_shots] shot ${shot.id} omni lookup: status=${omniJob?.status} url=${omniJob?.result_video_url?.slice(0, 50)}`)
        if (omniJob?.result_video_url) {
          omniVideoUrl = omniJob.result_video_url
          shotStatus = 'omni_done'
          await supabaseAdmin.from('movie_shots').update({ omni_video_url: omniVideoUrl, status: 'omni_done' }).eq('id', shot.id)
          console.log(`[cron/movie_shots] shot ${shot.id} omni_done updated`)
        }
      }

      // ── Check Kling scene via PiAPI (single poll, fast) ───────────────
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
              console.log(`[cron/movie_shots] shot ${shot.id} kling_done: ${klingSceneUrl}`)
            }
          }
        }
      }

      // ── Poll existing Shotstack render (single check, fast) ───────────
      if (shot.shotstack_render_id && !shot.final_shot_url && shotstackKey) {
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${shot.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          const renderStatus: string = pollData?.response?.status ?? 'unknown'
          console.log(`[cron/movie_shots] shot ${shot.id} Shotstack render ${shot.shotstack_render_id} status=${renderStatus}`)
          if (renderStatus === 'done') {
            const finalShotUrl: string | null = pollData?.response?.url ?? null
            if (finalShotUrl) {
              await supabaseAdmin.from('movie_shots').update({ final_shot_url: finalShotUrl, status: 'shot_complete' }).eq('id', shot.id)
              shotStatus = 'shot_complete'
              console.log(`[cron/movie_shots] shot ${shot.id} shot_complete: ${finalShotUrl}`)
            }
          } else if (renderStatus === 'failed') {
            await supabaseAdmin.from('movie_shots').update({ shotstack_render_id: null }).eq('id', shot.id)
            console.warn(`[cron/movie_shots] shot ${shot.id} Shotstack render failed, cleared render_id`)
          }
        }
        return // Don't submit new render while one is in flight
      }

      // ── Both ready + no render in flight → submit Shotstack (fire & forget) ─
      if (omniVideoUrl && klingSceneUrl && !shot.final_shot_url && !shot.shotstack_render_id) {
        if (shotstackKey) {
          // Fire and forget — don't await the render result
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
                console.log(`[cron/movie_shots] shot ${shot.id} Shotstack render submitted: ${renderId}`)
              }
            }
          }).catch((e) => console.warn(`[cron/movie_shots] shot ${shot.id} Shotstack submit error:`, e instanceof Error ? e.message : e))
        } else {
          // Fallback: Railway concat (fire and forget)
          fetch(`${railwayUrl}/concat-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneVideoUrl: klingSceneUrl, faceVideoUrl: omniVideoUrl }),
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              if (data.outputUrl) {
                await supabaseAdmin.from('movie_shots').update({ final_shot_url: data.outputUrl, status: 'shot_complete' }).eq('id', shot.id)
                console.log(`[cron/movie_shots] shot ${shot.id} shot_complete via Railway: ${data.outputUrl}`)
              }
            }
          }).catch((e) => console.warn(`[cron/movie_shots] shot ${shot.id} Railway concat error:`, e instanceof Error ? e.message : e))
        }
      }

      void shotStatus // suppress unused warning
    } catch (shotErr) {
      console.warn(`[cron/movie_shots] error for shot ${shot.id}:`, shotErr instanceof Error ? shotErr.message : shotErr)
    }
  }))

  // ── Find ALL movies where every shot is shot_complete but no final video ──
  // This catches movies that completed in previous ticks too
  const { data: completedMovieShots } = await supabaseAdmin
    .from('movie_shots')
    .select('movie_id')
    .eq('status', 'shot_complete')

  const allCompletedMovieIds = [...new Set((completedMovieShots ?? []).map((s: { movie_id: string }) => s.movie_id).filter(Boolean))]
  console.log(`[cron/movie_shots] Found ${allCompletedMovieIds.length} movies with at least one shot_complete`)

  for (const movieId of allCompletedMovieIds) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) break
    try {
      const { data: allShots } = await supabaseAdmin
        .from('movie_shots')
        .select('id, status, final_shot_url, shot_index')
        .eq('movie_id', movieId)
        .order('shot_index', { ascending: true })

      if (!allShots || allShots.length === 0) continue

      const allComplete = allShots.every((s: { status: string; final_shot_url: string | null }) =>
        s.status === 'shot_complete' && s.final_shot_url
      )

      if (!allComplete) {
        const completeCount = allShots.filter((s: { status: string }) => s.status === 'shot_complete').length
        console.log(`[cron/movie_shots] movie ${movieId}: ${completeCount}/${allShots.length} shots complete, waiting...`)
        continue
      }

      console.log(`[cron/movie_shots] All ${allShots.length} shots complete for movie ${movieId}, checking final video...`)

      // Check if final video already exists in omnihuman_jobs (keyed by movie_id as task_id)
      const { data: existingJob } = await supabaseAdmin
        .from('omnihuman_jobs')
        .select('id, result_video_url, shotstack_render_id')
        .eq('task_id', movieId)
        .single()

      if (existingJob?.result_video_url || existingJob?.shotstack_render_id) {
        console.log(`[cron/movie_shots] movie ${movieId} final concat already in progress or done`)
        continue
      }

      const shotUrls: string[] = allShots
        .map((s: { final_shot_url: string | null }) => s.final_shot_url)
        .filter(Boolean) as string[]

      console.log(`[cron/movie_shots] Concatenating ${shotUrls.length} shots for movie ${movieId}`)

      if (shotstackKey && shotUrls.length > 0) {
        const clips = shotUrls.map((url, i) => ({
          asset: { type: 'video', src: url },
          start: i * 10,
          length: 10,
          ...(i > 0 ? { transition: { in: 'fade' } } : {}),
          ...(i < shotUrls.length - 1 ? { transition: { out: 'fade' } } : {}),
        }))
        // Fire and forget
        fetch('https://api.shotstack.io/stage/render', {
          method: 'POST',
          headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeline: { tracks: [{ clips }] },
            output: { format: 'mp4', resolution: 'sd', aspectRatio: '9:16' },
          }),
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            const renderId: string | null = data?.response?.id ?? null
            if (renderId) {
              if (existingJob?.id) {
                await supabaseAdmin
                  .from('omnihuman_jobs')
                  .update({ shotstack_render_id: renderId, status: 'rendering', updated_at: new Date().toISOString() })
                  .eq('id', existingJob.id)
              } else {
                // Insert a new omnihuman_jobs row to track the final render
                await supabaseAdmin.from('omnihuman_jobs').insert({
                  task_id: movieId,
                  shotstack_render_id: renderId,
                  status: 'rendering',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
              }
              console.log(`[cron/movie_shots] Final Shotstack render submitted for movie ${movieId}: ${renderId}`)
            }
          } else {
            console.warn(`[cron/movie_shots] Shotstack submit failed for movie ${movieId}: ${res.status}`)
          }
        }).catch((e) => console.warn(`[cron/movie_shots] final concat submit error for movie ${movieId}:`, e instanceof Error ? e.message : e))
      } else if (shotUrls.length > 0) {
        // Railway fallback (sequential, fire and forget)
        ;(async () => {
          let currentUrl = shotUrls[0]
          for (let i = 1; i < shotUrls.length; i++) {
            const concatRes = await fetch(`${railwayUrl}/concat-videos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sceneVideoUrl: shotUrls[i], faceVideoUrl: currentUrl }),
            })
            if (concatRes.ok) {
              const concatData = await concatRes.json()
              currentUrl = concatData.outputUrl ?? currentUrl
            }
          }
          if (existingJob?.id) {
            await supabaseAdmin
              .from('omnihuman_jobs')
              .update({ result_video_url: currentUrl, status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', existingJob.id)
          } else {
            await supabaseAdmin.from('omnihuman_jobs').insert({
              task_id: movieId,
              result_video_url: currentUrl,
              status: 'completed',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          }
          console.log(`[cron/movie_shots] Final movie (Railway) for ${movieId}: ${currentUrl}`)
        })().catch((e) => console.warn(`[cron/movie_shots] Railway final concat error for movie ${movieId}:`, e instanceof Error ? e.message : e))
      }
    } catch (movieErr) {
      console.warn(`[cron/movie_shots] final concat error for movie ${movieId}:`, movieErr instanceof Error ? movieErr.message : movieErr)
    }
  }

  // ── Poll pending final-movie Shotstack renders ────────────────────────────
  if (Date.now() - cronStart <= CRON_BUDGET_MS) {
    const { data: renderingJobs } = await supabaseAdmin
      .from('omnihuman_jobs')
      .select('id, task_id, shotstack_render_id')
      .eq('status', 'rendering')
      .not('shotstack_render_id', 'is', null)
      .limit(5)

    for (const job of renderingJobs ?? []) {
      if (Date.now() - cronStart > CRON_BUDGET_MS) break
      try {
        if (!shotstackKey) continue
        const pollRes = await fetch(`https://api.shotstack.io/stage/render/${job.shotstack_render_id}`, {
          headers: { 'x-api-key': shotstackKey },
        })
        if (!pollRes.ok) continue
        const pollData = await pollRes.json()
        const renderStatus: string = pollData?.response?.status ?? 'unknown'
        console.log(`[cron/process-kling] Final render ${job.shotstack_render_id} status=${renderStatus} for movie ${job.task_id}`)
        if (renderStatus === 'done') {
          const finalMovieUrl: string | null = pollData?.response?.url ?? null
          if (finalMovieUrl) {
            await supabaseAdmin
              .from('omnihuman_jobs')
              .update({ result_video_url: finalMovieUrl, status: 'completed', shotstack_render_id: null, updated_at: new Date().toISOString() })
              .eq('id', job.id)
            console.log(`[cron/process-kling] Final movie complete for ${job.task_id}: ${finalMovieUrl}`)
          }
        } else if (renderStatus === 'failed') {
          await supabaseAdmin
            .from('omnihuman_jobs')
            .update({ status: 'failed', shotstack_render_id: null, updated_at: new Date().toISOString() })
            .eq('id', job.id)
          console.warn(`[cron/process-kling] Final render failed for movie ${job.task_id}`)
        }
      } catch (pollErr) {
        console.warn(`[cron/process-kling] final render poll error for job ${job.id}:`, pollErr instanceof Error ? pollErr.message : pollErr)
      }
    }
  }

  // Final movie assembly: concat all shot_complete shots
  const { data: shotCompleteRows } = await supabaseAdmin
    .from('movie_shots')
    .select('movie_id, final_shot_url, shot_index')
    .eq('status', 'shot_complete')
    .not('status', 'eq', 'movie_complete')
    .order('shot_index')

  if (shotCompleteRows && shotCompleteRows.length > 0) {
    const movieGroups: Record<string, string[]> = {}
    for (const row of shotCompleteRows) {
      if (!movieGroups[row.movie_id]) movieGroups[row.movie_id] = []
      movieGroups[row.movie_id].push(row.final_shot_url)
    }
    
    for (const [movieId, shotUrls] of Object.entries(movieGroups)) {
      const { data: allShots } = await supabaseAdmin
        .from('movie_shots')
        .select('status')
        .eq('movie_id', movieId)
      
      const allDone = allShots?.every(s => s.status === 'shot_complete')
      if (!allDone) continue
      
      const { data: existingJob } = await supabaseAdmin
        .from('omnihuman_jobs')
        .select('result_video_url')
        .eq('id', movieId)
        .single()
      
      if (existingJob?.result_video_url) continue
      
      console.log('[cron] All shots complete for movie:', movieId, 'shots:', shotUrls.length)
      
      // Use Railway concat as fallback
      const railwayUrl = process.env.RAILWAY_URL
      if (railwayUrl && shotUrls.length > 1) {
        // Concat sequentially: merge first two, then merge result with third, etc.
        let currentUrl = shotUrls[0]
        for (let i = 1; i < shotUrls.length; i++) {
          const concatRes = await fetch(`${railwayUrl}/concat-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sceneVideoUrl: currentUrl, faceVideoUrl: shotUrls[i] })
          })
          const concatData = await concatRes.json()
          if (concatData.outputUrl) currentUrl = concatData.outputUrl
        }
        
        await supabaseAdmin.from('omnihuman_jobs').upsert({
          id: movieId,
          task_id: movieId,
          status: 'completed',
          result_video_url: currentUrl
        })
        await supabaseAdmin
          .from('movie_shots')
          .update({ status: 'movie_complete' })
          .eq('movie_id', movieId)
        console.log('[cron] Final movie concat done:', currentUrl)
      }
    }
  }

  return NextResponse.json({
    processed: jobs?.length ?? 0,
    completed,
    failed,
    pending,
    concatSweep: concatCount,
  })
}
