import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step3-merge
 * Step 3: Poll merging shots (also catch old 'processing' with render_id) → mark done
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

  console.log('[step3-merge] Starting...')

  const { data: mergingShots } = await db
    .from('movie_shots')
    .select('id, shotstack_render_id, retry_count, movie_id')
    .in('status', ['merging', 'processing'])
    .not('shotstack_render_id', 'is', null)
    .limit(20)

  log.push(`[step3] merging shots to poll: ${mergingShots?.length ?? 0}`)

  for (const shot of mergingShots ?? []) {
    try {
      const pollRes = await fetch(`https://api.shotstack.io/v1/render/${shot.shotstack_render_id}`, {
        headers: { 'x-api-key': shotstackKey },
      })
      if (!pollRes.ok) continue
      const pollData = await pollRes.json()
      const renderStatus: string = pollData?.response?.status ?? 'unknown'
      log.push(`[step3] shot ${shot.id} render status: ${renderStatus}`)

      if (renderStatus === 'done') {
        const finalUrl: string | null = pollData?.response?.url ?? null
        if (finalUrl) {
          await db.from('movie_shots').update({ final_shot_url: finalUrl, status: 'done', shotstack_render_id: null }).eq('id', shot.id)
          log.push(`[step3] shot ${shot.id} done: ${finalUrl}`)
          processed++
        }
      } else if (renderStatus === 'failed') {
        const retryCount = (shot.retry_count ?? 0) + 1
        if (retryCount >= 3) {
          await db.from('movie_shots').update({ status: 'failed', shotstack_render_id: null }).eq('id', shot.id)
          log.push(`[step3] shot ${shot.id} failed after ${retryCount} retries`)
        } else {
          await db.from('movie_shots').update({ status: 'pending', shotstack_render_id: null, retry_count: retryCount }).eq('id', shot.id)
          log.push(`[step3] shot ${shot.id} render failed, reset to pending (retry ${retryCount})`)
        }
      }
    } catch (e) {
      log.push(`[step3] error for shot ${shot.id}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return NextResponse.json({ step: 3, processed, elapsed: Date.now() - start, log })
}
