import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = 'scriptflow-webhook-2026'

/**
 * POST /api/omnihuman-webhook
 *
 * Receives PiAPI OmniHuman task completion callbacks.
 *
 * Expected payload from PiAPI:
 * {
 *   task_id: string,
 *   status: 'completed' | 'failed' | 'processing' | ...,
 *   output?: { video_url?: string, url?: string },
 *   error?: string,
 *   secret?: string   // optional: sent in webhook_config.secret
 * }
 *
 * On success: updates omnihuman_jobs row with status + result_video_url
 */
export async function POST(request: NextRequest) {
  console.log('[omnihuman-webhook] ENTER', new Date().toISOString())

  try {
    // ── Verify secret ─────────────────────────────────────────────────────────
    // PiAPI sends the secret either as a header or in the body
    const headerSecret = request.headers.get('x-webhook-secret')
    const rawBody = await request.text()

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      console.error('[omnihuman-webhook] Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const bodySecret = body.secret as string | undefined
    const receivedSecret = headerSecret ?? bodySecret ?? ''

    if (receivedSecret !== WEBHOOK_SECRET) {
      console.warn('[omnihuman-webhook] Invalid secret:', receivedSecret?.slice(0, 8))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Extract fields ────────────────────────────────────────────────────────
    const taskId: string =
      (body.task_id as string) ??
      ((body.data as any)?.task_id as string) ??
      ''

    if (!taskId) {
      console.error('[omnihuman-webhook] Missing task_id in payload:', JSON.stringify(body).slice(0, 300))
      return NextResponse.json({ error: 'Missing task_id' }, { status: 400 })
    }

    // Normalise status
    const rawStatus: string =
      (body.status as string) ??
      ((body.data as any)?.status as string) ??
      'unknown'

    const isCompleted = rawStatus === 'completed' || rawStatus === 'success'
    const isFailed = rawStatus === 'failed' || rawStatus === 'error'

    const normalizedStatus = isCompleted ? 'completed' : isFailed ? 'failed' : rawStatus

    // Extract video URL from various PiAPI response shapes
    const output = (body.output ?? (body.data as any)?.output) as Record<string, unknown> | undefined
    const resultVideoUrl: string | null =
      (output?.video_url as string) ??
      (output?.url as string) ??
      null

    console.log('[omnihuman-webhook] task_id:', taskId, 'status:', normalizedStatus, 'videoUrl:', resultVideoUrl)

    // ── Update omnihuman_jobs table ───────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    }

    if (resultVideoUrl) {
      updatePayload.result_video_url = resultVideoUrl
    }

    const { error: dbError, count } = await supabaseAdmin
      .from('omnihuman_jobs')
      .update(updatePayload)
      .eq('task_id', taskId)

    if (dbError) {
      console.error('[omnihuman-webhook] DB update error:', dbError.message)
      // Return 200 so PiAPI doesn't retry — we log the error but don't fail
      return NextResponse.json({ received: true, warning: dbError.message })
    }

    console.log('[omnihuman-webhook] DB updated, rows affected:', count)

    return NextResponse.json({ received: true, task_id: taskId, status: normalizedStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[omnihuman-webhook] FATAL:', message)
    // Return 200 to prevent PiAPI from retrying on server errors
    return NextResponse.json({ received: true, error: message })
  }
}
