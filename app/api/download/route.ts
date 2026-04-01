import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const upstream = await fetch(url, { cache: 'no-store' })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${upstream.status}` },
        { status: 502 },
      )
    }

    const body = upstream.body
    if (!body) {
      return NextResponse.json({ error: 'Empty response from upstream' }, { status: 502 })
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'attachment; filename="scriptflow-episode.mp4"',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
    }

    // Forward Content-Length from upstream so the browser knows the full file size
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength
    }

    // Forward Content-Range if upstream returned a partial response
    const contentRange = upstream.headers.get('content-range')
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange
    }

    return new NextResponse(body as ReadableStream, {
      status: upstream.status === 206 ? 206 : 200,
      headers: responseHeaders,
    })
  } catch (err) {
    console.error('[api/download]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
