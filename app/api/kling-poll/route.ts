import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'

/**
 * GET /api/kling-poll?taskId=xxx
 *
 * Poll PiAPI for Kling task status.
 * Returns:
 *   { status: 'completed', videoUrl: '...' }
 *   { status: 'processing' }
 *   { status: 'failed', error: '...' }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  console.log('[kling-poll] taskId:', taskId)

  const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
      headers: { 'x-api-key': piApiKey },
    })

    if (!pollRes.ok) {
      console.warn('[kling-poll] PiAPI poll failed:', pollRes.status)
      return NextResponse.json({ status: 'processing' })
    }

    const pollData = await pollRes.json()
    const status: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
    console.log('[kling-poll] PiAPI status:', status)

    if (status === 'completed' || status === 'success') {
      const videoUrl: string | null =
        pollData?.data?.output?.video_url ??
        pollData?.data?.output?.video ??
        pollData?.data?.output?.url ??
        pollData?.output?.video_url ??
        pollData?.output?.video ??
        null

      console.log('[kling-poll] completed, videoUrl:', videoUrl)
      return NextResponse.json({ status: 'completed', videoUrl })
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = pollData?.data?.error?.message ?? pollData?.data?.error ?? 'unknown error'
      console.error('[kling-poll] task failed:', errMsg)
      return NextResponse.json({ status: 'failed', error: errMsg })
    }

    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[kling-poll] FATAL:', message)
    return NextResponse.json({ status: 'processing', error: message })
  }
}
