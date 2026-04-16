import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webhook/omnihuman
 * Receives webhook from PiAPI when an OmniHuman task completes.
 * Updates omnihuman_jobs and movie_shots, then triggers Shotstack if both omni + kling are done.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[webhook/omnihuman] Received payload:', JSON.stringify(body).slice(0, 500))

    // Verify webhook secret if configured
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const incomingSecret = request.headers.get('x-webhook-secret') ?? request.headers.get('x-piapi-secret') ?? ''
      if (incomingSecret !== secret) {
        console.warn('[webhook/omnihuman] Invalid webhook secret')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extract task_id and video URL from PiAPI payload
    const taskId: string | null =
      body?.task_id ??
      body?.data?.task_id ??
      null

    const status: string =
      body?.status ??
      body?.data?.status ??
      'unknown'

    const videoUrl: string | null =
      body?.data?.output?.video?.resource_without_watermark ??
      body?.data?.output?.video_url ??
      body?.data?.output?.video ??
      body?.data?.output?.url ??
      body?.output?.video?.resource_without_watermark ??
      body?.output?.video_url ??
      body?.output?.url ??
      null

    console.log('[webhook/omnihuman] task_id:', taskId, 'status:', status, 'videoUrl:', videoUrl)

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task_id in payload' }, { status: 400 })
    }

    if (status !== 'completed' && status !== 'success') {
      // Not completed yet — acknowledge but do nothing
      console.log('[webhook/omnihuman] Task not completed yet, status:', status)
      return NextResponse.json({ received: true, status })
    }

    if (!videoUrl) {
      console.warn('[webhook/omnihuman] Task completed but no video URL found')
      return NextResponse.json({ error: 'No video URL in payload' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    // Update omnihuman_jobs: status='completed', result_video_url=url
    const { error: jobUpdateErr } = await db
      .from('omnihuman_jobs')
      .update({
        status: 'completed',
        result_video_url: videoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', taskId)

    if (jobUpdateErr) {
      console.error('[webhook/omnihuman] Failed to update omnihuman_jobs:', jobUpdateErr.message)
    } else {
      console.log('[webhook/omnihuman] omnihuman_jobs updated for task_id:', taskId)
    }

    // Find the movie_shot with this omni_task_id
    const { data: shot, error: shotFetchErr } = await db
      .from('movie_shots')
      .select('*')
      .eq('omni_task_id', taskId)
      .single()

    if (shotFetchErr || !shot) {
      console.warn('[webhook/omnihuman] No movie_shot found for omni_task_id:', taskId)
      return NextResponse.json({ received: true, warning: 'No matching movie_shot' })
    }

    // Update movie_shots: omni_video_url=url, status='processing'
    const { error: shotUpdateErr } = await db
      .from('movie_shots')
      .update({
        omni_video_url: videoUrl,
        status: 'processing',
      })
      .eq('id', shot.id)

    if (shotUpdateErr) {
      console.error('[webhook/omnihuman] Failed to update movie_shots:', shotUpdateErr.message)
    } else {
      console.log('[webhook/omnihuman] movie_shots updated for shot id:', shot.id)
    }

    // Check if Kling is also done → submit Shotstack immediately
    const klingSceneUrl: string | null = shot.kling_scene_url ?? null
    const isSceneOnly = shot.shot_type === 'scene'

    if (klingSceneUrl && !isSceneOnly) {
      console.log('[webhook/omnihuman] Both omni + kling done → submitting Shotstack for shot:', shot.id)
      await submitShotstack(db, shot.id, videoUrl, klingSceneUrl, shot.duration ?? 10)
    } else if (!klingSceneUrl) {
      console.log('[webhook/omnihuman] Omni done, waiting for Kling for shot:', shot.id)
    }

    return NextResponse.json({ received: true, taskId, videoUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[webhook/omnihuman] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function submitShotstack(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  shotId: string,
  omniVideoUrl: string,
  klingSceneUrl: string,
  duration: number,
) {
  const shotstackKey = process.env.SHOTSTACK_API_KEY
  if (!shotstackKey) {
    console.warn('[webhook/omnihuman] SHOTSTACK_API_KEY not configured, skipping Shotstack submit')
    return
  }

  try {
    const clips = [
      { asset: { type: 'video', src: omniVideoUrl }, start: 0, length: duration },
      { asset: { type: 'video', src: klingSceneUrl }, start: duration, length: duration },
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
        await db.from('movie_shots').update({ shotstack_render_id: renderId, status: 'merging' }).eq('id', shotId)
        console.log('[webhook/omnihuman] Shotstack render submitted, renderId:', renderId)
      } else {
        console.warn('[webhook/omnihuman] Shotstack no renderId:', JSON.stringify(ssData?.response?.errors))
      }
    } else {
      const errText = await ssRes.text()
      console.error('[webhook/omnihuman] Shotstack submit failed:', ssRes.status, errText)
    }
  } catch (e) {
    console.error('[webhook/omnihuman] Shotstack submit error:', e instanceof Error ? e.message : e)
  }
}
