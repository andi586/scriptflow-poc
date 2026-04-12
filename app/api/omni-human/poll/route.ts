import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'

/**
 * GET /api/omni-human/poll?taskId=xxx
 *
 * 1. Check omnihuman_jobs table — if status=completed, return videoUrl immediately
 * 2. Otherwise poll PiAPI directly for current status
 * 3. If completed, update omnihuman_jobs and return { status: 'completed', videoUrl }
 * 4. If still processing, return { status: 'processing' }
 * 5. If failed, return { status: 'failed', error }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  console.log('[omni-human/poll] taskId:', taskId)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Step 1: Check DB first ────────────────────────────────────────────────
  try {
    const { data: jobRow } = await supabase
      .from('omnihuman_jobs')
      .select('status, result_video_url')
      .eq('task_id', taskId)
      .single()

    if (jobRow?.status === 'completed' && jobRow?.result_video_url) {
      console.log('[omni-human/poll] DB hit: completed, videoUrl:', jobRow.result_video_url)
      return NextResponse.json({
        status: 'completed',
        videoUrl: jobRow.result_video_url,
      })
    }

    if (jobRow?.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'OmniHuman task failed' })
    }
  } catch (dbErr) {
    console.warn('[omni-human/poll] DB check failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
  }

  // ── Step 2: Poll PiAPI directly ───────────────────────────────────────────
  const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
      headers: { 'x-api-key': piApiKey },
    })

    if (!pollRes.ok) {
      console.warn('[omni-human/poll] PiAPI poll failed:', pollRes.status)
      return NextResponse.json({ status: 'processing' })
    }

    const pollData = await pollRes.json()
    const status: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
    console.log('[omni-human/poll] PiAPI status:', status)

    if (status === 'completed' || status === 'success') {
      const videoUrl: string | null =
        pollData?.data?.output?.video ??
        pollData?.data?.output?.video_url ??
        pollData?.data?.output?.url ??
        pollData?.output?.video ??
        pollData?.output?.video_url ??
        null

      console.log('[omni-human/poll] completed, videoUrl:', videoUrl)

      // Update DB
      if (videoUrl) {
        try {
          await supabase
            .from('omnihuman_jobs')
            .update({
              status: 'completed',
              result_video_url: videoUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('task_id', taskId)
        } catch (dbErr) {
          console.warn('[omni-human/poll] DB update failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
        }
      }

      return NextResponse.json({ status: 'completed', videoUrl })
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = pollData?.data?.error?.message ?? pollData?.data?.error ?? 'unknown error'
      console.error('[omni-human/poll] task failed:', errMsg)

      try {
        await supabase
          .from('omnihuman_jobs')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('task_id', taskId)
      } catch {}

      return NextResponse.json({ status: 'failed', error: errMsg })
    }

    // pending or processing
    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[omni-human/poll] FATAL:', message)
    return NextResponse.json({ status: 'processing', error: message })
  }
}
