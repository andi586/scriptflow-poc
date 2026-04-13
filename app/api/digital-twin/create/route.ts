import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/digital-twin/create
 * Body: { videoUrl: string, sessionId: string }
 *
 * 1. Calls Railway /extract-frame to get a frame at 50% of the video
 * 2. Inserts a row into digital_twins table
 * 3. Returns { twinId, frameUrl }
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl, sessionId } = await request.json()

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── Step 1: Extract frame from video via Railway ──────────────────────
    const railwayUrl =
      process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'

    let frameUrl: string | null = null
    try {
      console.log('[digital-twin/create] Extracting frame from video:', videoUrl)
      const frameRes = await fetch(`${railwayUrl}/extract-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      })
      if (frameRes.ok) {
        const frameData = await frameRes.json()
        frameUrl = frameData.frameUrl ?? null
        console.log('[digital-twin/create] frameUrl:', frameUrl)
      } else {
        const errText = await frameRes.text()
        console.warn('[digital-twin/create] Railway extract-frame failed:', frameRes.status, errText)
      }
    } catch (frameErr) {
      console.warn('[digital-twin/create] Railway extract-frame error:', frameErr instanceof Error ? frameErr.message : frameErr)
    }

    if (!frameUrl) {
      return NextResponse.json({ error: 'Failed to extract frame from video' }, { status: 500 })
    }

    // ── Step 2: Get auth user (optional — falls back to sessionId) ────────
    let userId: string | null = null
    try {
      const authHeader = request.headers.get('authorization')
      if (authHeader) {
        const userSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: authHeader } } },
        )
        const { data } = await userSupabase.auth.getUser()
        userId = data?.user?.id ?? null
      }
    } catch {}

    // ── Step 3: Insert into digital_twins table ───────────────────────────
    const { data: twin, error: insertErr } = await supabase
      .from('digital_twins')
      .insert({
        user_id: userId,
        session_id: sessionId ?? null,
        frame_url_mid: frameUrl,
        is_active: true,
      })
      .select('id, frame_url_mid')
      .single()

    if (insertErr) {
      console.error('[digital-twin/create] DB insert failed:', insertErr.message)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    console.log('[digital-twin/create] twin created:', twin.id)
    return NextResponse.json({ twinId: twin.id, frameUrl: twin.frame_url_mid })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[digital-twin/create] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
