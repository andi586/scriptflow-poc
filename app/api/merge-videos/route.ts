import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, videoUrls, audioUrls, srtContent } = body

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'projectId required' }, { status: 400 })
    }
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'videoUrls required' }, { status: 400 })
    }

    const mergeServiceUrl = process.env.VIDEO_MERGE_SERVICE_URL
    if (!mergeServiceUrl) {
      return NextResponse.json({ success: false, error: 'VIDEO_MERGE_SERVICE_URL not configured' }, { status: 500 })
    }

    const payload: Record<string, unknown> = {
      projectId,
      videoUrls,
    }

    if (Array.isArray(audioUrls) && audioUrls.length > 0) {
      payload.audioUrls = audioUrls
    }

    if (srtContent) {
      payload.srtContent = srtContent
    }

    console.log('[merge-videos] calling', mergeServiceUrl + '/merge', 'videos:', videoUrls.length)

    const mergeRes = await fetch(`${mergeServiceUrl}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await mergeRes.json() as { success: boolean; finalVideoUrl?: string; error?: string }

    if (!mergeRes.ok || !data.success) {
      return NextResponse.json(
        { success: false, error: data.error || `Merge service error: ${mergeRes.status}` },
        { status: mergeRes.status || 500 }
      )
    }

    return NextResponse.json({
      success: true,
      finalVideoUrl: data.finalVideoUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[merge-videos] error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
