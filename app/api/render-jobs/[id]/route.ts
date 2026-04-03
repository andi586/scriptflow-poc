import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * GET /api/render-jobs/[id]
 * Returns the current status of a render job.
 * Frontend polls this every 5 seconds to track progress.
 *
 * Response: { jobId, status, stage, progress, error?, output? }
 *   status: 'queued' | 'running' | 'done' | 'failed'
 *   stage:  'queued' | 'analyzing_story' | 'locking_characters' |
 *           'generating_prompts' | 'submitting_kling' | 'done'
 *   progress: 0–100
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const jobId = id?.trim()
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Missing job id' }, { status: 400 })
    }

    // Authenticate user via session cookie
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      },
    )

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const { data: job, error } = await supabase
      .from('render_jobs')
      .select('id, status, stage, progress, error_message, output_json, started_at, completed_at, created_at')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      error: job.error_message ?? null,
      output: job.output_json ?? null,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
    })
  } catch (err) {
    console.error('[render-jobs GET]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
