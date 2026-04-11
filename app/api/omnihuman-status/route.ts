import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/omnihuman-status?taskId=xxx
 *
 * Queries the omnihuman_jobs table and returns the current status
 * and result_video_url (if completed).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('omnihuman_jobs')
      .select('task_id, status, result_video_url, created_at')
      .eq('task_id', taskId)
      .single()

    if (error || !data) {
      console.warn('[omnihuman-status] job not found for taskId:', taskId, error?.message)
      return NextResponse.json({ status: 'pending', result_video_url: null })
    }

    console.log('[omnihuman-status] taskId:', taskId, 'status:', data.status)

    return NextResponse.json({
      status: data.status,
      result_video_url: data.result_video_url ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[omnihuman-status] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
