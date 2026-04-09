import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const RAILWAY_FFMPEG_URL =
  process.env.RAILWAY_FFMPEG_URL ||
  'https://scriptflow-video-merge-production.up.railway.app'

export async function POST(request: NextRequest) {
  try {
    const { projectId, sceneVideos, voiceoverUrl, bgmUrl } = await request.json()

    if (!projectId || !Array.isArray(sceneVideos) || sceneVideos.length === 0) {
      return NextResponse.json(
        { error: 'projectId and sceneVideos (non-empty array) are required' },
        { status: 400 }
      )
    }

    // Build audioUrls: voiceoverUrl first, then optional bgmUrl
    const audioUrls: string[] = []
    if (voiceoverUrl) audioUrls.push(voiceoverUrl)
    if (bgmUrl) audioUrls.push(bgmUrl)

    const payload: Record<string, unknown> = {
      projectId,
      videoUrls: sceneVideos,
    }
    if (audioUrls.length > 0) payload.audioUrls = audioUrls

    console.log('[api/video/merge] calling Railway /merge, videos:', sceneVideos.length)

    const response = await fetch(`${RAILWAY_FFMPEG_URL}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = (await response.json()) as {
      success: boolean
      finalVideoUrl?: string
      error?: string
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || `Railway merge failed (${response.status})` },
        { status: response.status || 500 }
      )
    }

    return NextResponse.json({
      success: true,
      outputUrl: result.finalVideoUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/video/merge] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
