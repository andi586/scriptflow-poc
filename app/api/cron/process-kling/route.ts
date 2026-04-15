import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/process-kling
 *
 * Server-side cron job (runs every minute via vercel.json).
 * Handles the omnihuman_jobs pipeline ONLY (not movie_shots).
 * movie_shots is handled by /api/cron/process-movies.
 *
 * Order:
 * 1. scene_task_id polling
 * 2. OmniHuman polling
 * 3. Kling polling
 * 4. catch-all concat (only if > 30s budget remaining)
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
  // Step 1: Poll scene_task_id for omnihuman_jobs
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before scene_task_id step, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 'scene_task_id' })
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

  // ════════════════════════════════════════════════════════════════════════
  // Step 2: Check OmniHuman pending/processing jobs
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before OmniHuman step, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 'omnihuman' })
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

  // ════════════════════════════════════════════════════════════════════════
  // Step 3: Find all jobs waiting on Kling
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Kling step, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 'kling' })
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
                const shotstackRes = await fetch('https://api.shotstack.io/v1/render', {
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

  // ════════════════════════════════════════════════════════════════════════
  // Step 4 (LAST): Catch-all concat sweep — only if > 30s budget remaining
  // ════════════════════════════════════════════════════════════════════════
  const elapsed = Date.now() - cronStart
  const remaining = CRON_BUDGET_MS - elapsed
  if (remaining < 30000) {
    console.log(`[cron] Only ${remaining}ms remaining, skipping catch-all concat`)
    return NextResponse.json({ processed: jobs?.length ?? 0, completed, failed, pending, concatSweep: 0 })
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

  return NextResponse.json({
    processed: jobs?.length ?? 0,
    completed,
    failed,
    pending,
    concatSweep: concatCount,
  })
}
