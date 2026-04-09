import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/be-the-star/poll?taskId=xxx
 *
 * Strategy (in order):
 * 1. Check omnihuman_jobs table — if status=completed and result_video_url exists, return immediately.
 *    This handles the case where the webhook already delivered the result but the frontend
 *    lost the connection and never received it.
 * 2. Fall back to polling PiAPI directly for live status.
 *
 * Returns: { status: 'pending' | 'processing' | 'completed' | 'failed', videoUrl?: string, error?: string }
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  // ── Step 1: Check omnihuman_jobs table first ──────────────────────────────
  try {
    const { data: jobRow, error: dbError } = await supabaseAdmin
      .from('omnihuman_jobs')
      .select('status, result_video_url')
      .eq('task_id', taskId)
      .maybeSingle()

    if (!dbError && jobRow) {
      console.log(`[be-the-star/poll] DB row found: taskId=${taskId} status=${jobRow.status} videoUrl=${jobRow.result_video_url}`)

      if (jobRow.status === 'completed' && jobRow.result_video_url) {
        // Webhook already delivered the result — return immediately
        return NextResponse.json({ status: 'completed', videoUrl: jobRow.result_video_url, source: 'db' })
      }

      if (jobRow.status === 'failed') {
        return NextResponse.json({ status: 'failed', error: 'Task failed (from DB)', source: 'db' })
      }
    }
  } catch (dbErr) {
    // Non-fatal — fall through to PiAPI poll
    console.warn('[be-the-star/poll] DB check failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
  }

  // ── Step 2: Fall back to PiAPI direct poll ────────────────────────────────
  const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const PIAPI_BASE = 'https://api.piapi.ai/api/v1'
    const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
      headers: { 'x-api-key': piApiKey },
    })

    if (!pollRes.ok) {
      console.warn(`[be-the-star/poll] PiAPI poll failed: ${pollRes.status}`)
      return NextResponse.json({ status: 'pending' })
    }

    const pollData = await pollRes.json()
    const rawStatus: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
    console.log(`[be-the-star/poll] PiAPI taskId=${taskId} status=${rawStatus}`)

    if (rawStatus === 'completed' || rawStatus === 'success') {
      const videoUrl: string | null =
        pollData?.data?.output?.video ??
        pollData?.data?.output?.video_url ??
        pollData?.data?.output?.url ??
        pollData?.output?.video ??
        pollData?.output?.video_url ??
        pollData?.output?.url ??
        null

      if (!videoUrl) {
        console.warn('[be-the-star/poll] completed but no videoUrl in PiAPI response:', JSON.stringify(pollData).slice(0, 300))
        return NextResponse.json({ status: 'processing' })
      }

      // Also update DB in case webhook was missed
      try {
        await supabaseAdmin
          .from('omnihuman_jobs')
          .update({ status: 'completed', result_video_url: videoUrl, updated_at: new Date().toISOString() })
          .eq('task_id', taskId)
      } catch {}

      return NextResponse.json({ status: 'completed', videoUrl, source: 'piapi' })
    }

    if (rawStatus === 'failed' || rawStatus === 'error') {
      const errMsg = pollData?.data?.error ?? pollData?.error ?? 'unknown error'
      console.error('[be-the-star/poll] task failed:', errMsg)
      return NextResponse.json({ status: 'failed', error: errMsg })
    }

    // pending / processing / queued — keep polling
    return NextResponse.json({ status: 'processing' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[be-the-star/poll] error:', message)
    // Return processing so frontend keeps trying
    return NextResponse.json({ status: 'processing' })
  }
}
