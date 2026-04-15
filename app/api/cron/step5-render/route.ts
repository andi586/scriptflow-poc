import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step5-render
 * Step 5: Poll rendering movies → mark final_complete
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

  console.log('[step5-render] Starting...')

  const { data: renderingJobs } = await db
    .from('omnihuman_jobs')
    .select('id, task_id, shotstack_render_id')
    .eq('status', 'rendering')
    .not('shotstack_render_id', 'is', null)
    .limit(5)

  log.push(`[step5] rendering jobs to poll: ${renderingJobs?.length ?? 0}`)

  for (const job of renderingJobs ?? []) {
    try {
      const pollRes = await fetch(`https://api.shotstack.io/v1/render/${job.shotstack_render_id}`, {
        headers: { 'x-api-key': shotstackKey },
      })
      if (!pollRes.ok) continue
      const pollData = await pollRes.json()
      const renderStatus: string = pollData?.response?.status ?? 'unknown'
      log.push(`[step5] movie ${job.task_id} render status: ${renderStatus}`)

      if (renderStatus === 'done') {
        const finalUrl: string | null = pollData?.response?.url ?? null
        if (finalUrl) {
          await db.from('omnihuman_jobs').update({ result_video_url: finalUrl, status: 'completed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
          await db.from('movie_shots').update({ status: 'final_complete' }).eq('movie_id', job.task_id)
          log.push(`[step5] movie ${job.task_id} final_complete: ${finalUrl}`)
          processed++
        }
      } else if (renderStatus === 'failed') {
        await db.from('omnihuman_jobs').update({ status: 'failed', shotstack_render_id: null, updated_at: new Date().toISOString() }).eq('id', job.id)
        log.push(`[step5] movie ${job.task_id} final render failed`)
      }
    } catch (e) {
      log.push(`[step5] error for job ${job.id}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return NextResponse.json({ step: 5, processed, elapsed: Date.now() - start, log })
}
