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
 * POST /api/render-jobs
 * Body: { projectId: string }
 * Creates a new render_job record and returns { jobId, status: 'queued' }.
 * Does NOT execute any pipeline — just enqueues the job.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json().catch(() => ({})) as { projectId?: string }
    const projectId = (body.projectId ?? '').trim()
    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: 'Project not found or access denied' }, { status: 404 })
    }

    // Insert render_job record
    const { data: job, error: insertError } = await supabase
      .from('render_jobs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        input_json: { projectId },
      })
      .select('id, status, stage, progress')
      .single()

    if (insertError || !job) {
      console.error('[render-jobs POST] insert error', insertError)
      return NextResponse.json({ success: false, error: insertError?.message ?? 'Failed to create job' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
    })
  } catch (err) {
    console.error('[render-jobs POST]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
