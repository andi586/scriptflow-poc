import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/video/download?url=<encoded>&filename=<encoded>
 *
 * Proxy endpoint that fetches a remote video and streams it back with
 * Content-Disposition: attachment so browsers / iOS Web Share API can
 * receive the file as a Blob and save it to the Camera Roll.
 *
 * iOS Safari cannot directly download cross-origin videos via <a download>,
 * so the VideoDownloadButton component fetches through this proxy, creates
 * a File object, and passes it to navigator.share({ files }) which triggers
 * the native iOS share sheet — letting the user tap "Save Video".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const filename = searchParams.get('filename') || 'episode.mp4'

  if (!url) {
    return NextResponse.json({ error: 'url param is required' }, { status: 400 })
  }

  // Basic URL validation — only allow http(s)
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid url param' }, { status: 400 })
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        // Pass through a reasonable user-agent
        'User-Agent': 'ScriptFlow/1.0 (video-proxy)',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: upstream.status }
      )
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4'
    const body = upstream.body

    if (!body) {
      return NextResponse.json({ error: 'Empty response from upstream' }, { status: 502 })
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Allow the browser / PWA to cache the proxied video briefly
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[api/video/download] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
