import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webhook/kling
 * Receives webhook from PiAPI when a Kling task completes.
 * Updates movie_shots, then triggers Shotstack if both omni + kling are done.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[webhook/kling] Received payload:', JSON.stringify(body).slice(0, 500))

    // Verify webhook secret if configured
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const incomingSecret = request.headers.get('x-webhook-secret') ?? request.headers.get('x-piapi-secret') ?? ''
      if (incomingSecret !== secret) {
        console.warn('[webhook/kling] Invalid webhook secret')
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

    console.log('[webhook/kling] task_id:', taskId, 'status:', status, 'videoUrl:', videoUrl)

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task_id in payload' }, { status: 400 })
    }

    if (status !== 'completed' && status !== 'success') {
      // Not completed yet — acknowledge but do nothing
      console.log('[webhook/kling] Task not completed yet, status:', status)
      return NextResponse.json({ received: true, status })
    }

    if (!videoUrl) {
      console.warn('[webhook/kling] Task completed but no video URL found')
      return NextResponse.json({ error: 'No video URL in payload' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    // Find the movie_shot with this kling_task_id
    const { data: shot, error: shotFetchErr } = await db
      .from('movie_shots')
      .select('*')
      .eq('kling_task_id', taskId)
      .single()

    if (shotFetchErr || !shot) {
      console.warn('[webhook/kling] No movie_shot found for kling_task_id:', taskId)
      return NextResponse.json({ received: true, warning: 'No matching movie_shot' })
    }

    // Update movie_shots: kling_scene_url=url, status='processing'
    const { error: shotUpdateErr } = await db
      .from('movie_shots')
      .update({
        kling_scene_url: videoUrl,
        status: 'processing',
      })
      .eq('id', shot.id)

    if (shotUpdateErr) {
      console.error('[webhook/kling] Failed to update movie_shots:', shotUpdateErr.message)
    } else {
      console.log('[webhook/kling] movie_shots updated for shot id:', shot.id)
    }

    const isSceneOnly = shot.shot_type === 'scene'
    const omniVideoUrl: string | null = shot.omni_video_url ?? null

    if (isSceneOnly) {
      // Scene-only shot: just kling needed → submit Shotstack immediately
      console.log('[webhook/kling] Scene-only shot done → submitting Shotstack for shot:', shot.id)
      await submitShotstack(db, shot.id, null, videoUrl, shot.duration ?? 5, true)
    } else if (omniVideoUrl) {
      // Face shot: both omni + kling done → submit Shotstack immediately
      console.log('[webhook/kling] Both omni + kling done → submitting Shotstack for shot:', shot.id)
      await submitShotstack(db, shot.id, omniVideoUrl, videoUrl, shot.duration ?? 10, false)
    } else {
      console.log('[webhook/kling] Kling done, waiting for OmniHuman for shot:', shot.id)
    }

    return NextResponse.json({ received: true, taskId, videoUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[webhook/kling] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function submitShotstack(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  shotId: string,
  omniVideoUrl: string | null,
  klingSceneUrl: string,
  duration: number,
  isSceneOnly: boolean,
) {
  const shotstackKey = process.env.SHOTSTACK_API_KEY
  if (!shotstackKey) {
    console.warn('[webhook/kling] SHOTSTACK_API_KEY not configured, skipping Shotstack submit')
    return
  }

  try {
    const clips = isSceneOnly
      ? [{ asset: { type: 'video', src: klingSceneUrl }, start: 0, length: duration }]
      : [
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
        console.log('[webhook/kling] Shotstack render submitted, renderId:', renderId)
      } else {
        console.warn('[webhook/kling] Shotstack no renderId:', JSON.stringify(ssData?.response?.errors))
      }
    } else {
      const errText = await ssRes.text()
      console.error('[webhook/kling] Shotstack submit failed:', ssRes.status, errText)
    }
  } catch (e) {
    console.error('[webhook/kling] Shotstack submit error:', e instanceof Error ? e.message : e)
  }
}
