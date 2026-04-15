import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step2-poll
 * Step 2: Poll submitted/processing shots → submit Shotstack merge when both ready
 */

export async function GET() {
  const start = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const piApiKey    = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  const shotstackKey = process.env.SHOTSTACK_API_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)
  const log: string[] = []
  let processed = 0

  console.log('[step2-poll] Starting...')

  const { data: pendingShots } = await db
    .from('movie_shots')
    .select('*')
    .in('status', ['submitted', 'processing', 'merging', 'omni_done', 'kling_done', 'scene_only'])
    .is('shotstack_render_id', null)
    .limit(20)

  console.log('[orchestrator] step2] active shots:', pendingShots?.length ?? 0)

  // Migrate legacy statuses on-the-fly
  for (const shot of pendingShots ?? []) {
    if (['omni_done', 'kling_done'].includes(shot.status)) {
      await db.from('movie_shots').update({ status: 'processing' }).eq('id', shot.id)
      shot.status = 'processing'
    } else if (shot.status === 'scene_only') {
      await db.from('movie_shots').update({ status: 'submitted' }).eq('id', shot.id)
      shot.status = 'submitted'
    }
  }

  const activeShots = pendingShots
  log.push(`[step2] active shots to poll: ${activeShots?.length ?? 0}`)

  for (const shot of activeShots ?? []) {
    try {
      let omniVideoUrl: string | null = shot.omni_video_url ?? null
      let klingSceneUrl: string | null = shot.kling_scene_url ?? null

      // Check OmniHuman via PiAPI directly (source of truth)
      if (shot.omni_task_id && !omniVideoUrl) {
        const piRes = await fetch(`https://api.piapi.ai/api/v1/task/${shot.omni_task_id}`, {
          headers: { 'x-api-key': piApiKey },
        })
        if (piRes.ok) {
          const piData = await piRes.json()
          const omniStatus: string = piData?.data?.status ?? 'unknown'
          const omniUrl: string | null =
            piData?.data?.output?.video?.resource_without_watermark ??
            piData?.data?.output?.video_url ??
            piData?.data?.output?.video ??
            piData?.data?.output?.url ?? null
          log.push(`[step2] shot ${shot.id} omni PiAPI status=${omniStatus}`)
          if ((omniStatus === 'completed' || omniStatus === 'success') && omniUrl) {
            omniVideoUrl = omniUrl
            // Update omnihuman_jobs
            await db.from('omnihuman_jobs')
              .update({ status: 'completed', result_video_url: omniUrl, updated_at: new Date().toISOString() })
              .eq('task_id', shot.omni_task_id)
            // Update movie_shots — use unified 'processing' (omni done, waiting for kling)
            await db.from('movie_shots').update({ omni_video_url: omniUrl, status: 'processing' }).eq('id', shot.id)
            log.push(`[step2] shot ${shot.id} omni done → processing via PiAPI: ${omniUrl}`)
          }
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
              await db.from('movie_shots').update({ kling_scene_url: klingSceneUrl, status: 'processing' }).eq('id', shot.id)
              log.push(`[step2] shot ${shot.id} kling done → processing`)
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

        const ssRes = await fetch('https://api.shotstack.io/v1/render', {
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
            processed++
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

  return NextResponse.json({ step: 2, processed, elapsed: Date.now() - start, log })
}
