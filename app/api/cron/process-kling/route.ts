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

  // ── Step 1: Check OmniHuman pending/processing jobs ───────────────────────
  // Poll PiAPI for jobs that haven't reached Kling yet
  const { data: pendingJobs } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .is('kling_task_id', null)

  console.log(`[cron/process-kling] Found ${pendingJobs?.length ?? 0} OmniHuman pending/processing jobs`)

  let omniCompleted = 0
  let omniStillPending = 0

  for (const job of pendingJobs ?? []) {
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
        // Mark OmniHuman as done
        await supabaseAdmin
          .from('omnihuman_jobs')
          .update({
            status: 'kling_pending',
            result_video_url: omniVideoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        // Submit Kling task
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
            console.log(`[cron/process-kling] Kling submit status for job ${job.id}:`, klingRes.status)
            if (!klingRes.ok) {
              const klingError = await klingRes.text()
              console.error(`[cron/process-kling] Kling submit FAILED for job ${job.id}:`, klingError)
            } else {
              const klingData = await klingRes.json()
              const klingTaskId: string | null = klingData?.data?.task_id ?? null
              console.log(`[cron/process-kling] Kling taskId for job ${job.id}:`, klingTaskId)
              if (klingTaskId) {
                await supabaseAdmin
                  .from('omnihuman_jobs')
                  .update({
                    kling_task_id: klingTaskId,
                    status: 'kling_processing',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', job.id)
                omniCompleted++
              }
            }
          } catch (klingErr) {
            console.warn(`[cron/process-kling] Kling submit error for job ${job.id}:`, klingErr instanceof Error ? klingErr.message : klingErr)
          }
        } else {
          console.warn(`[cron/process-kling] job ${job.id} has no image_url — cannot submit Kling`)
          omniStillPending++
        }
      } else if (omniStatus === 'failed' || omniStatus === 'error') {
        const errMsg = omniData?.data?.error?.message ?? omniData?.data?.error ?? 'unknown error'
        await supabaseAdmin
          .from('omnihuman_jobs')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', job.id)
        console.error(`[cron/process-kling] OmniHuman job ${job.id} failed:`, errMsg)
      } else {
        // Still processing
        omniStillPending++
      }
    } catch (err) {
      console.error(`[cron/process-kling] Error checking OmniHuman job ${job.id}:`, err instanceof Error ? err.message : err)
      omniStillPending++
    }
  }

  console.log(`[cron/process-kling] OmniHuman check done: ${omniCompleted} submitted to Kling, ${omniStillPending} still pending`)

  // ── Step 2: Find all jobs waiting on Kling ────────────────────────────────
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
        const videoUrl: string | null =
          data?.data?.output?.video_url ??
          data?.data?.output?.video ??
          data?.data?.output?.url ??
          null

        if (videoUrl) {
          await supabaseAdmin
            .from('omnihuman_jobs')
            .update({
              status: 'completed',
              result_video_url: videoUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          console.log(`[cron/process-kling] job ${job.id} completed, videoUrl:`, videoUrl)
          completed++

          // Send push notification (non-fatal)
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : 'http://localhost:3000'
            await fetch(`${baseUrl}/api/push/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: job.task_id, videoUrl }),
            })
            console.log(`[cron/process-kling] Push notification sent for job ${job.id}`)
          } catch (pushErr) {
            console.warn(`[cron/process-kling] Push notification failed (non-fatal):`, pushErr instanceof Error ? pushErr.message : pushErr)
          }
        } else {
          console.warn(`[cron/process-kling] job ${job.id} completed but no videoUrl in response`)
          pending++
        }
      } else if (status === 'failed' || status === 'error') {
        const errMsg = data?.data?.error?.message ?? data?.data?.error ?? 'unknown error'
        await supabaseAdmin
          .from('omnihuman_jobs')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        console.error(`[cron/process-kling] job ${job.id} failed:`, errMsg)
        failed++
      } else {
        // Still processing
        pending++
      }
    } catch (err) {
      console.error(`[cron/process-kling] Error processing job ${job.id}:`, err instanceof Error ? err.message : err)
      pending++
    }
  }

  return NextResponse.json({
    processed: jobs?.length ?? 0,
    completed,
    failed,
    pending,
  })
}
