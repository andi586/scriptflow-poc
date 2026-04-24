import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/process-kling
 *
 * Server-side cron job (runs every minute via vercel.json).
 * Handles Kling polling only.
 */
export async function GET(request: Request) {
  console.log('[process-kling] START')
  console.log('[process-kling] ENTERED HANDLER')
  console.log('KLING KEY:', process.env.KLING_API_KEY)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const piApiKey    = process.env.KLING_API_KEY

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
  // Step 1: Find all jobs waiting on Kling
  // ════════════════════════════════════════════════════════════════════════
  if (Date.now() - cronStart > CRON_BUDGET_MS) {
    console.log('[cron] Budget exceeded before Kling step, stopping early')
    return NextResponse.json({ stopped: 'budget_exceeded', step: 'kling' })
  }

  console.log('[process-kling] about to query kling_jobs')
  console.log('[process-kling] querying jobs...')
  const { data: jobs, error: fetchErr } = await supabaseAdmin
    .from('kling_jobs')
    .select('*')
    .eq('status', 'pending')

  if (fetchErr) {
    console.error('[cron/process-kling] DB fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  console.log('[process-kling] jobs raw:', jobs)
  console.log('[process-kling] jobs found:', jobs?.length ?? 0)

  let completed = 0
  let failed = 0
  let pending = 0

  for (const job of jobs ?? []) {
    if (Date.now() - cronStart > CRON_BUDGET_MS) { console.log('[cron] Budget exceeded in kling loop, stopping'); break }
    console.log('[process-kling] processing job:', job.id)
    try {
      console.log('[process-kling] sending to Kling:', job.prompt)
      const pollRes = await fetch(
        `https://api.piapi.ai/api/v1/task/${job.kling_task_id}`,
        {
          method: 'GET',
          headers: {
            'x-api-key': process.env.KLING_API_KEY!
          }
        }
      )

      if (!pollRes.ok) {
        console.warn(`[cron/process-kling] PiAPI poll failed for job ${job.id}: ${pollRes.status}`)
        pending++
        continue
      }

      const pollData = await pollRes.json()
      console.log('[process-kling] poll result:', pollData)
      const data = pollData
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

          const { data: jobData } = await supabaseAdmin.from('kling_jobs').select('scene_video_url').eq('id', job.id).single()

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
                  await supabaseAdmin.from('kling_jobs').update({
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

          await supabaseAdmin.from('kling_jobs').update({
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
        await supabaseAdmin.from('kling_jobs').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', job.id)
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
  // Step 2 (LAST): Catch-all concat sweep — only if > 30s budget remaining
  // ════════════════════════════════════════════════════════════════════════
  const elapsed = Date.now() - cronStart
  const remaining = CRON_BUDGET_MS - elapsed
  if (remaining < 30000) {
    console.log(`[cron] Only ${remaining}ms remaining, skipping catch-all concat`)
    return NextResponse.json({ processed: jobs?.length ?? 0, completed, failed, pending, concatSweep: 0 })
  }

  const { data: concatJobs } = await supabaseAdmin
    .from('kling_jobs')
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
          await supabaseAdmin.from('kling_jobs').update({ result_video_url: concatData.outputUrl, updated_at: new Date().toISOString() }).eq('id', job.id)
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
