import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  generateKlingPromptsAction,
  submitKlingTasksAction,
  pollProjectKlingVideoStatusAction,
} from '@/actions/narrative.actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Update render_job status/stage/progress in DB */
async function updateJob(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  patch: {
    status?: string
    stage?: string
    progress?: number
    error_message?: string | null
    output_json?: Record<string, unknown> | null
    started_at?: string
    completed_at?: string
  },
) {
  const { error } = await supabase
    .from('render_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) {
    console.error('[render-jobs/run] updateJob error', error)
  }
}

/** Wait ms milliseconds */
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * POST /api/render-jobs/[id]/run
 *
 * Background worker entry point. Executes the full pipeline:
 *   1. generateKlingPromptsAction  (stage: script_generating, progress 10→30)
 *   2. submitKlingTasksAction       (stage: video_generating,  progress 30→50)
 *   3. Poll Kling until all done    (stage: video_generating,  progress 50→80)
 *   4. Call /api/pipeline/finalize  (stage: merging,           progress 80→100)
 *
 * Updates render_jobs table at each step so the frontend can poll GET /api/render-jobs/[id].
 *
 * This endpoint is called by the frontend immediately after POST /api/render-jobs.
 * It is fire-and-forget from the frontend perspective (no await on the response).
 * The frontend polls GET /api/render-jobs/[id] for progress.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const jobId = id?.trim()
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'Missing job id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Load job to get projectId
  const { data: job, error: jobError } = await supabase
    .from('render_jobs')
    .select('id, project_id, status, input_json')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }

  // Prevent double-run
  if (job.status === 'running' || job.status === 'done') {
    return NextResponse.json({ success: true, message: `Job already ${job.status}` })
  }

  const projectId: string = job.project_id

  // Mark as running immediately so the frontend sees progress
  await updateJob(supabase, jobId, {
    status: 'running',
    stage: 'script_generating',
    progress: 10,
    started_at: new Date().toISOString(),
  })

  // Return 202 immediately — the actual work runs in the background
  // (Next.js will keep the serverless function alive until the async work completes
  //  as long as maxDuration allows it)
  const responsePromise = NextResponse.json({ success: true, jobId, status: 'running' }, { status: 202 })

  // Run pipeline asynchronously (after returning the response)
  void runPipeline(supabase, jobId, projectId)

  return responsePromise
}

async function runPipeline(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  projectId: string,
) {
  try {
    // ── Step 1: Generate Kling prompts ──────────────────────────────────────
    console.log(`[render-jobs/run] [${jobId}] step=generating_prompts`)
    await updateJob(supabase, jobId, { stage: 'script_generating', progress: 15 })

    const promptsRes = await generateKlingPromptsAction({ projectId })
    if (!promptsRes.success) {
      throw new Error(`generateKlingPromptsAction failed: ${promptsRes.error}`)
    }
    const prompts = promptsRes.data.prompts

    await updateJob(supabase, jobId, { stage: 'script_generating', progress: 30 })
    console.log(`[render-jobs/run] [${jobId}] prompts generated: ${prompts.length}`)

    // ── Step 2: Submit Kling tasks ──────────────────────────────────────────
    console.log(`[render-jobs/run] [${jobId}] step=submitting_kling`)
    await updateJob(supabase, jobId, { stage: 'video_generating', progress: 35 })

    const submitRes = await submitKlingTasksAction({ projectId, prompts: prompts as any })
    if (!submitRes.success) {
      throw new Error(`submitKlingTasksAction failed: ${submitRes.error}`)
    }
    const submittedTaskIds = submitRes.data.tasks.map((t: any) => t.task_id).filter(Boolean)
    console.log(`[render-jobs/run] [${jobId}] submitted ${submittedTaskIds.length} Kling tasks`)

    await updateJob(supabase, jobId, {
      stage: 'video_generating',
      progress: 50,
      output_json: { taskIds: submittedTaskIds },
    })

    // ── Step 3: Poll Kling until all tasks complete ─────────────────────────
    console.log(`[render-jobs/run] [${jobId}] step=polling_kling`)
    const MAX_POLL_ATTEMPTS = 40   // 40 × 30s = 20 minutes max
    const POLL_INTERVAL_MS = 30_000

    let allDone = false
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS)

      const pollRes = await pollProjectKlingVideoStatusAction({ projectId })
      if (!pollRes.success) {
        console.warn(`[render-jobs/run] [${jobId}] poll attempt ${attempt + 1} failed: ${pollRes.error}`)
        continue
      }

      const tasks = pollRes.data.tasks
      const total = tasks.length
      const done = tasks.filter((t: any) => t.status === 'success').length
      const failed = tasks.filter((t: any) => t.status === 'failed' || t.status === 'url_missing').length

      const pollProgress = Math.min(79, 50 + Math.round((done / Math.max(total, 1)) * 29))
      await updateJob(supabase, jobId, { stage: 'video_generating', progress: pollProgress })

      console.log(`[render-jobs/run] [${jobId}] poll ${attempt + 1}: ${done}/${total} done, ${failed} failed`)

      if (done + failed >= total && total > 0) {
        allDone = true
        break
      }
    }

    if (!allDone) {
      console.warn(`[render-jobs/run] [${jobId}] Kling polling timed out — proceeding to finalize anyway`)
    }

    // ── Step 4: Finalize (voice + merge) ───────────────────────────────────
    console.log(`[render-jobs/run] [${jobId}] step=finalize`)
    await updateJob(supabase, jobId, { stage: 'merging', progress: 80 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const finalizeRes = await fetch(`${baseUrl}/api/pipeline/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })

    const finalizeData = await finalizeRes.json().catch(() => ({})) as {
      success?: boolean
      finalVideoUrl?: string
      error?: string
    }

    if (!finalizeData.success || !finalizeData.finalVideoUrl) {
      // Finalize failed — still mark job done with partial output
      console.warn(`[render-jobs/run] [${jobId}] finalize failed: ${finalizeData.error}`)
      await updateJob(supabase, jobId, {
        status: 'done',
        stage: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        output_json: {
          finalVideoUrl: null,
          taskIds: submittedTaskIds,
          finalizeError: finalizeData.error ?? 'Finalize failed',
        },
      })
      return
    }

    // ── Done ────────────────────────────────────────────────────────────────
    console.log(`[render-jobs/run] [${jobId}] DONE finalVideoUrl=${finalizeData.finalVideoUrl}`)
    await updateJob(supabase, jobId, {
      status: 'done',
      stage: 'completed',
      progress: 100,
      completed_at: new Date().toISOString(),
      output_json: {
        finalVideoUrl: finalizeData.finalVideoUrl,
        taskIds: submittedTaskIds,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[render-jobs/run] [${jobId}] FAILED: ${msg}`)
    await updateJob(supabase, jobId, {
      status: 'failed',
      stage: 'failed',
      error_message: msg.slice(0, 2000),
      completed_at: new Date().toISOString(),
    })
  }
}
