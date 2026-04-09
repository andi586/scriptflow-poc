import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/be-the-star/poll?taskId=xxx
 *
 * Query OmniHuman task status once and return immediately.
 * Frontend calls this every 5 seconds until status === 'completed'.
 *
 * Returns: { status: 'pending' | 'processing' | 'completed' | 'failed', videoUrl?: string, error?: string }
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

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
    console.log(`[be-the-star/poll] taskId=${taskId} status=${rawStatus}`)

    if (rawStatus === 'completed' || rawStatus === 'success') {
      const videoUrl: string | null =
        pollData?.data?.output?.video_url ??
        pollData?.data?.output?.url ??
        pollData?.output?.video_url ??
        pollData?.output?.url ??
        null

      if (!videoUrl) {
        console.warn('[be-the-star/poll] completed but no videoUrl in response:', JSON.stringify(pollData).slice(0, 300))
        return NextResponse.json({ status: 'processing' })
      }

      return NextResponse.json({ status: 'completed', videoUrl })
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
