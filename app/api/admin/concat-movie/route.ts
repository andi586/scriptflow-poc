import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/concat-movie
 * Body: { movieId: string }
 *
 * Manually triggers final movie concat for a given movieId.
 * Queries all movie_shots ordered by shot_index, concats via Railway, updates omnihuman_jobs.
 */
export async function POST(request: NextRequest) {
  try {
    const { movieId } = await request.json()

    if (!movieId) {
      return NextResponse.json({ error: 'movieId is required' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const railwayUrl =
      process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'

    // Query all movie_shots ordered by shot_index
    const { data: shots, error: shotsErr } = await supabaseAdmin
      .from('movie_shots')
      .select('shot_index, final_shot_url, status')
      .eq('movie_id', movieId)
      .order('shot_index', { ascending: true })

    if (shotsErr) {
      return NextResponse.json({ error: shotsErr.message }, { status: 500 })
    }

    if (!shots || shots.length === 0) {
      return NextResponse.json({ error: 'No shots found for this movieId' }, { status: 404 })
    }

    const urls: string[] = shots
      .map((s: { final_shot_url: string | null }) => s.final_shot_url)
      .filter(Boolean) as string[]

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No final_shot_url found in any shots' }, { status: 400 })
    }

    console.log(`[admin/concat-movie] movieId=${movieId} shots=${shots.length} urls=${urls.length}`)

    // Concat sequentially via Railway
    let currentUrl = urls[0]
    for (let i = 1; i < urls.length; i++) {
      const res = await fetch(`${railwayUrl}/concat-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneVideoUrl: currentUrl,
          faceVideoUrl: urls[i],
        }),
      })
      const data = await res.json()
      if (data.outputUrl) {
        currentUrl = data.outputUrl
        console.log(`[admin/concat-movie] step ${i}/${urls.length - 1} → ${currentUrl}`)
      } else {
        console.warn(`[admin/concat-movie] concat step ${i} failed:`, data)
        break
      }
    }

    // Update omnihuman_jobs with final URL
    const { error: updateErr } = await supabaseAdmin
      .from('omnihuman_jobs')
      .update({ result_video_url: currentUrl, status: 'completed', updated_at: new Date().toISOString() })
      .eq('task_id', movieId)

    if (updateErr) {
      console.warn('[admin/concat-movie] omnihuman_jobs update failed:', updateErr.message)
      // Try insert if update found nothing
      await supabaseAdmin.from('omnihuman_jobs').insert({
        task_id: movieId,
        status: 'completed',
        result_video_url: currentUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    console.log(`[admin/concat-movie] Final movie ready: ${currentUrl}`)
    return NextResponse.json({ finalUrl: currentUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/concat-movie] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
