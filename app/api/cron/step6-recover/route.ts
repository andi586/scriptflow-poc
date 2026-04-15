import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step6-recover
 * Step 6: Auto-recovery for stuck shots
 */

export async function GET() {
  const start = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)
  const log: string[] = []
  let processed = 0

  console.log('[step6-recover] Starting...')

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // Stuck submitted shots
  const { data: stuckSubmitted } = await db
    .from('movie_shots')
    .select('id')
    .eq('status', 'submitted')
    .lt('submitted_at', tenMinAgo)
    .limit(10)

  if (stuckSubmitted && stuckSubmitted.length > 0) {
    await db.from('movie_shots')
      .update({ status: 'pending', omni_task_id: null, kling_task_id: null })
      .in('id', stuckSubmitted.map((s: { id: string }) => s.id))
    log.push(`[step6] reset ${stuckSubmitted.length} stuck submitted shots`)
    processed += stuckSubmitted.length
  }

  // Stuck processing shots
  const { data: stuckProcessing } = await db
    .from('movie_shots')
    .select('id')
    .eq('status', 'processing')
    .lt('updated_at', fifteenMinAgo)
    .limit(10)

  if (stuckProcessing && stuckProcessing.length > 0) {
    await db.from('movie_shots')
      .update({ status: 'pending' })
      .in('id', stuckProcessing.map((s: { id: string }) => s.id))
    log.push(`[step6] reset ${stuckProcessing.length} stuck processing shots`)
    processed += stuckProcessing.length
  }

  // Stuck omni_done shots (OmniHuman done but Kling never finished)
  const { data: stuckOmniDone } = await db
    .from('movie_shots')
    .select('id')
    .eq('status', 'omni_done')
    .lt('updated_at', tenMinAgo)
    .limit(10)

  if (stuckOmniDone && stuckOmniDone.length > 0) {
    await db.from('movie_shots')
      .update({ status: 'pending' })
      .in('id', stuckOmniDone.map((s: { id: string }) => s.id))
    log.push(`[step6] reset ${stuckOmniDone.length} stuck omni_done shots`)
    processed += stuckOmniDone.length
  }

  // scene_only shots with no kling_task_id
  const { data: sceneNoKling } = await db
    .from('movie_shots')
    .select('id')
    .eq('status', 'scene_only')
    .is('kling_task_id', null)
    .limit(10)

  if (sceneNoKling && sceneNoKling.length > 0) {
    await db.from('movie_shots')
      .update({ status: 'pending' })
      .in('id', sceneNoKling.map((s: { id: string }) => s.id))
    log.push(`[step6] reset ${sceneNoKling.length} scene_only shots with no kling_task_id`)
    processed += sceneNoKling.length
  }

  return NextResponse.json({ step: 6, processed, elapsed: Date.now() - start, log })
}
