import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

/**
 * POST /api/admin/concat-movie
 * Body: { movieId: string }
 *
 * Manually triggers final movie concat for a given movieId using Shotstack.
 * Queries all movie_shots ordered by shot_index, submits a single Shotstack render,
 * polls until done, then updates omnihuman_jobs with the final URL.
 */
export async function POST(req: NextRequest) {
  const { movieId } = await req.json()

  if (!movieId) {
    return NextResponse.json({ error: 'movieId is required' }, { status: 400 })
  }

  const { data: shots, error: shotsErr } = await supabaseAdmin
    .from('movie_shots')
    .select('shot_index, final_shot_url, duration')
    .eq('movie_id', movieId)
    .order('shot_index')

  if (shotsErr) {
    return NextResponse.json({ error: shotsErr.message }, { status: 500 })
  }

  if (!shots || shots.length === 0) {
    return NextResponse.json({ error: 'No shots found' }, { status: 404 })
  }

  const urls = shots.map((s: { final_shot_url: string | null }) => s.final_shot_url).filter(Boolean) as string[]

  if (urls.length === 0) {
    return NextResponse.json({ error: 'No final_shot_url found in any shots' }, { status: 400 })
  }

  console.log('[concat-movie] Shotstack concat', urls.length, 'shots for movie:', movieId)

  // Build Shotstack timeline with all shots
  let currentTime = 0
  const clips = urls.map((url, i) => {
    const duration = (shots[i] as { duration?: number })?.duration ?? 10
    const clip: Record<string, unknown> = {
      asset: { type: 'video', src: url },
      start: currentTime,
      length: duration,
    }
    if (i > 0) clip.transition = { in: 'fade' }
    currentTime += duration
    return clip
  })

  // Submit to Shotstack
  const shotstackRes = await fetch('https://api.shotstack.io/stage/render', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SHOTSTACK_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeline: { tracks: [{ clips }] },
      output: { format: 'mp4', resolution: 'sd', aspectRatio: '9:16' },
    }),
  })

  const shotstackData = await shotstackRes.json()
  const renderId: string | null = shotstackData?.response?.id ?? null
  console.log('[concat-movie] Shotstack renderId:', renderId)

  if (!renderId) {
    return NextResponse.json({ error: 'Shotstack failed', data: shotstackData }, { status: 500 })
  }

  // Poll until done (max 3 minutes, 36 × 5s)
  let finalUrl: string | null = null
  for (let i = 0; i < 36; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const pollRes = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
      headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY! },
    })
    const pollData = await pollRes.json()
    const status: string = pollData?.response?.status ?? 'unknown'
    console.log('[concat-movie] Shotstack status:', status)
    if (status === 'done') {
      finalUrl = pollData?.response?.url ?? null
      break
    }
    if (status === 'failed') break
  }

  if (!finalUrl) {
    return NextResponse.json({ error: 'Shotstack render failed or timed out' }, { status: 500 })
  }

  // Update omnihuman_jobs
  const { data: existing } = await supabaseAdmin
    .from('omnihuman_jobs')
    .select('id')
    .eq('task_id', movieId)
    .single()

  if (existing) {
    await supabaseAdmin
      .from('omnihuman_jobs')
      .update({ result_video_url: finalUrl, status: 'completed', updated_at: new Date().toISOString() })
      .eq('task_id', movieId)
  } else {
    await supabaseAdmin.from('omnihuman_jobs').insert({
      task_id: movieId,
      status: 'completed',
      result_video_url: finalUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  console.log('[concat-movie] Final movie ready:', finalUrl)
  return NextResponse.json({ finalUrl })
}
