import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'

/**
 * GET /api/omni-human/poll?taskId=xxx
 *
 * 1. Check omnihuman_jobs table — if status=completed, return videoUrl immediately
 * 2. Otherwise poll PiAPI directly for current status
 * 3. If completed, update omnihuman_jobs and return { status: 'completed', videoUrl }
 * 4. If still processing, return { status: 'processing' }
 * 5. If failed, return { status: 'failed', error }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  console.log('[omni-human/poll] taskId:', taskId)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── Step 1: Check DB first ────────────────────────────────────────────────
  let storedImageUrl: string | null = null
  try {
    const { data: jobRow } = await supabase
      .from('omnihuman_jobs')
      .select('status, result_video_url, image_url, kling_task_id')
      .eq('task_id', taskId)
      .single()

    storedImageUrl = jobRow?.image_url ?? null

    if (jobRow?.status === 'completed' && jobRow?.result_video_url) {
      console.log('[omni-human/poll] DB hit: completed, videoUrl:', jobRow.result_video_url)
      return NextResponse.json({
        status: 'completed',
        videoUrl: jobRow.result_video_url,
      })
    }

    if (jobRow?.status === 'kling_processing' && jobRow?.kling_task_id) {
      return NextResponse.json({
        status: 'kling_processing',
        klingTaskId: jobRow.kling_task_id,
      })
    }

    if (jobRow?.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: 'OmniHuman task failed' })
    }
  } catch (dbErr) {
    console.warn('[omni-human/poll] DB check failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
  }

  // ── Step 2: Poll PiAPI directly ───────────────────────────────────────────
  const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
      headers: { 'x-api-key': piApiKey },
    })

    if (!pollRes.ok) {
      console.warn('[omni-human/poll] PiAPI poll failed:', pollRes.status)
      return NextResponse.json({ status: 'processing' })
    }

    const pollData = await pollRes.json()
    const status: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
    console.log('[omni-human/poll] PiAPI status:', status)

    if (status === 'completed' || status === 'success') {
      const videoUrl: string | null =
        pollData?.data?.output?.video ??
        pollData?.data?.output?.video_url ??
        pollData?.data?.output?.url ??
        pollData?.output?.video ??
        pollData?.output?.video_url ??
        null

      console.log('[omni-human/poll] OmniHuman COMPLETED, videoUrl:', videoUrl)
      console.log('[omni-human/poll] imageUrl from DB:', storedImageUrl)
      console.log('[omni-human/poll] About to submit Kling task...')

      // Update DB and submit Kling task
      if (videoUrl) {
        try {
          await supabase
            .from('omnihuman_jobs')
            .update({
              status: 'completed',
              result_video_url: videoUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('task_id', taskId)
        } catch (dbErr) {
          console.warn('[omni-human/poll] DB update failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
        }

        // ── Get imageUrl from PiAPI task input (more reliable than DB) ────
        let imageUrlForKling: string | null = storedImageUrl
        try {
          const taskRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
            headers: { 'x-api-key': piApiKey },
          })
          const taskData = await taskRes.json()
          const fromTask: string | null = taskData?.data?.input?.image_url ?? null
          console.log('[omni-human/poll] imageUrl from PiAPI task:', fromTask)
          if (fromTask) imageUrlForKling = fromTask
        } catch (taskErr) {
          console.warn('[omni-human/poll] Failed to fetch task input (non-fatal):', taskErr instanceof Error ? taskErr.message : taskErr)
        }

        // ── Get story prompt from project ─────────────────────────────────
        let storyPrompt = 'cinematic dramatic scene'
        try {
          const { data: jobRow2 } = await supabase
            .from('omnihuman_jobs')
            .select('project_id')
            .eq('task_id', taskId)
            .single()
          if (jobRow2?.project_id) {
            const { data: project } = await supabase
              .from('projects')
              .select('script_raw')
              .eq('id', jobRow2.project_id)
              .single()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = project?.script_raw as any
            const fromProject: string | null =
              raw?.userInput ?? raw?.story ?? raw?.script ?? null
            if (fromProject) {
              storyPrompt = fromProject.slice(0, 200) // cap length
              console.log('[omni-human/poll] storyPrompt from project:', storyPrompt)
            }
          }
        } catch (storyErr) {
          console.warn('[omni-human/poll] Failed to fetch story prompt (non-fatal):', storyErr instanceof Error ? storyErr.message : storyErr)
        }

        // ── Submit Kling task using imageUrl as reference ─────────────────
        if (imageUrlForKling) {
          try {
            console.log('[omni-human/poll] Submitting Kling task with imageUrl:', imageUrlForKling)
            const klingPrompt = `${storyPrompt}, cinematic lighting, dramatic scene, film quality, ultra realistic, ${imageUrlForKling ? '@image_1 as main character' : ''}`
            const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
              body: JSON.stringify({
                model: 'kling',
                task_type: 'video_generation',
                input: {
                  prompt: klingPrompt,
                  negative_prompt: 'cartoon, anime, blur, distorted',
                  aspect_ratio: '9:16',
                  duration: 5,
                  version: '1.6',
                  mode: 'pro',
                  elements: [{ image_url: imageUrlForKling }],
                },
              }),
            })
            console.log('[omni-human/poll] Kling submit response status:', klingRes.status)
            if (!klingRes.ok) {
              const klingError = await klingRes.text()
              console.error('[omni-human/poll] Kling submit FAILED:', klingError)
            } else {
              const klingData = await klingRes.json()
              const klingTaskId: string | null = klingData?.data?.task_id ?? null
              console.log('[omni-human/poll] Kling taskId:', klingTaskId)

              if (klingTaskId) {
                await supabase
                  .from('omnihuman_jobs')
                  .update({
                    status: 'kling_processing',
                    kling_task_id: klingTaskId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('task_id', taskId)

                return NextResponse.json({ status: 'kling_processing', klingTaskId })
              }
            }
          } catch (klingErr) {
            console.warn('[omni-human/poll] Kling submit failed (non-fatal):', klingErr instanceof Error ? klingErr.message : klingErr)
          }
        } else {
          console.warn('[omni-human/poll] imageUrlForKling is null — Kling will NOT be submitted')
        }
      }

      return NextResponse.json({ status: 'completed', videoUrl })
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = pollData?.data?.error?.message ?? pollData?.data?.error ?? 'unknown error'
      console.error('[omni-human/poll] task failed:', errMsg)

      try {
        await supabase
          .from('omnihuman_jobs')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('task_id', taskId)
      } catch {}

      return NextResponse.json({ status: 'failed', error: errMsg })
    }

    // pending or processing
    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[omni-human/poll] FATAL:', message)
    return NextResponse.json({ status: 'processing', error: message })
  }
}
