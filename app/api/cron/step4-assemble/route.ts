import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step4-assemble
 * Step 4: Assemble complete movies → submit final Shotstack render
 */

export async function GET() {
  const start = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const shotstackKey = process.env.SHOTSTACK_API_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!shotstackKey) {
    return NextResponse.json({ error: 'SHOTSTACK_API_KEY not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)
  const log: string[] = []
  let processed = 0

  console.log('[step4-assemble] Starting...')

  // Find movies with at least one done shot (unified status)
  const { data: shotCompleteRows } = await db
    .from('movie_shots')
    .select('movie_id')
    .in('status', ['done', 'shot_complete'])

  const candidateMovieIds = [...new Set((shotCompleteRows ?? []).map((r: { movie_id: string }) => r.movie_id))]
  log.push(`[step4] candidate movies: ${candidateMovieIds.length}`)

  for (const movieId of candidateMovieIds) {
    try {
      // Skip if already rendering or final_complete
      const { data: doneCheck } = await db
        .from('movie_shots')
        .select('id')
        .eq('movie_id', movieId)
        .in('status', ['final_complete'])
        .limit(1)
      if (doneCheck && doneCheck.length > 0) continue

      const { data: renderingCheck } = await db
        .from('omnihuman_jobs')
        .select('id')
        .eq('task_id', movieId)
        .eq('status', 'rendering')
        .limit(1)
      if (renderingCheck && renderingCheck.length > 0) continue

      // Get all shots for this movie
      const { data: allShots } = await db
        .from('movie_shots')
        .select('status, final_shot_url, shot_index, duration')
        .eq('movie_id', movieId)
        .order('shot_index', { ascending: true })

      if (!allShots || allShots.length === 0) continue

      // All shots must be shot_complete or failed (no pending/processing/merging)
      const hasInProgress = allShots.some((s: { status: string }) =>
        ['pending', 'submitted', 'processing', 'merging', 'scene_only', 'omni_done', 'kling_done'].includes(s.status)
      )
      if (hasInProgress) {
        log.push(`[step4] movie ${movieId} still has in-progress shots, skipping`)
        continue
      }

      const shotsWithUrl = allShots.filter((s: { final_shot_url: string | null }) => s.final_shot_url)
      if (shotsWithUrl.length === 0) continue

      log.push(`[step4] movie ${movieId} ready for assembly: ${shotsWithUrl.length} shots`)

      // Build sequential Shotstack timeline
      const clips = shotsWithUrl.map((s: { final_shot_url: string | null; duration?: number }, i: number) => {
        let clipStart = 0
        for (let j = 0; j < i; j++) {
          clipStart += (shotsWithUrl[j] as { duration?: number }).duration ?? 10
        }
        return { asset: { type: 'video', src: s.final_shot_url }, start: clipStart, length: s.duration ?? 10 }
      })

      const ssRes = await fetch('https://api.shotstack.io/v1/render', {
        method: 'POST',
        headers: { 'x-api-key': shotstackKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline: { tracks: [{ clips }] }, output: { format: 'mp4', resolution: 'sd' } }),
      })

      if (ssRes.ok) {
        const ssData = await ssRes.json()
        log.push(`[step4] Shotstack errors: ${JSON.stringify(ssData?.response?.errors)}`)
        const renderId: string | null = ssData?.response?.id ?? null
        if (renderId) {
          // Upsert into omnihuman_jobs
          const { data: existingJob } = await db.from('omnihuman_jobs').select('id').eq('task_id', movieId).single()
          if (existingJob) {
            await db.from('omnihuman_jobs').update({ shotstack_render_id: renderId, status: 'rendering', updated_at: new Date().toISOString() }).eq('task_id', movieId)
          } else {
            await db.from('omnihuman_jobs').insert({ task_id: movieId, shotstack_render_id: renderId, status: 'rendering', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          }
          log.push(`[step4] movie ${movieId} final render submitted: ${renderId}`)
          processed++
        }
      }
    } catch (e) {
      log.push(`[step4] error for movie ${movieId}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return NextResponse.json({ step: 4, processed, elapsed: Date.now() - start, log })
}
