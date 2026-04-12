import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40 // 40 * 3s = 120s max

/**
 * OmniHuman API wrapper
 *
 * POST /api/omni-human
 * Body: { imageUrl, audioUrl, prompt?, projectId? }
 *
 * Flow:
 * 1. Submit task to PiAPI OmniHuman
 * 2. Poll until completed or timeout
 * 3. Return video URL
 * 4. Optionally store in projects.keyframe_url
 */
export async function POST(request: NextRequest) {
  console.log('[omni-human] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const { imageUrl, audioUrl, prompt, projectId } = body as {
      imageUrl?: string
      audioUrl?: string
      prompt?: string
      projectId?: string
    }

    console.log('[omni-human] params:', {
      hasImageUrl: !!imageUrl,
      hasAudioUrl: !!audioUrl,
      prompt,
      projectId,
    })

    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    console.log('[PiAPI] key prefix:', piApiKey?.slice(0, 8))
    if (!piApiKey) {
      console.error('[omni-human] PIAPI_API_KEY not set — returning stub')
      return NextResponse.json({
        success: false,
        error: 'PIAPI_API_KEY not configured',
        videoUrl: null,
        stub: true,
      })
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }
    if (!audioUrl) {
      return NextResponse.json({ error: 'audioUrl is required' }, { status: 400 })
    }

    // ── Convert webm to mp3 via Railway if needed ─────────────────────────────
    let finalAudioUrl = audioUrl
    if (audioUrl.endsWith('.webm')) {
      try {
        const railwayUrl = process.env.RAILWAY_URL ?? 'https://scriptflow-video-merge-production.up.railway.app'
        const convertRes = await fetch(`${railwayUrl}/convert-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl }),
        })
        const convertData = await convertRes.json()
        if (convertData.mp3Url) {
          finalAudioUrl = convertData.mp3Url
          console.log('[omni-human] converted webm to mp3 via Railway:', finalAudioUrl)
        } else {
          console.warn('[omni-human] Railway convert-audio returned no mp3Url:', convertData)
        }
      } catch (e) {
        console.warn('[omni-human] Railway webm conversion failed, using original:', e)
      }
    }

    // ── Step 1: Submit task ───────────────────────────────────────────────────
    const taskPayload = {
      model: 'omni-human',
      task_type: 'omni-human-1.5',
      input: {
        image_url: imageUrl,
        audio_url: finalAudioUrl,
        prompt: prompt ?? 'person speaks naturally cinematic',
        fast_mode: true,
      },
    }

    console.log('[omni-human] submitting task to PiAPI:', JSON.stringify(taskPayload))

    const submitRes = await fetch(`${PIAPI_BASE}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': piApiKey,
      },
      body: JSON.stringify(taskPayload),
    })

    console.log('[omni-human] submit response status:', submitRes.status)

    if (!submitRes.ok) {
      const errText = await submitRes.text().catch(() => 'unknown')
      console.error('[omni-human] submit failed:', submitRes.status, errText)
      return NextResponse.json({
        success: false,
        error: `PiAPI submit failed: ${submitRes.status} ${errText}`,
        videoUrl: null,
      }, { status: 502 })
    }

    const submitData = await submitRes.json()
    const taskId: string = submitData?.data?.task_id ?? submitData?.task_id
    console.log('[omni-human] task_id:', taskId)

    if (!taskId) {
      console.error('[omni-human] no task_id in response:', JSON.stringify(submitData))
      return NextResponse.json({
        success: false,
        error: 'No task_id returned from PiAPI',
        videoUrl: null,
      }, { status: 502 })
    }

    // ── Step 2: Poll for result ───────────────────────────────────────────────
    let videoUrl: string | null = null
    let attempts = 0

    while (attempts < MAX_POLL_ATTEMPTS) {
      attempts++
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

      console.log(`[omni-human] polling attempt ${attempts}/${MAX_POLL_ATTEMPTS}, task_id: ${taskId}`)

      const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
        headers: { 'x-api-key': piApiKey },
      })

      if (!pollRes.ok) {
        console.warn(`[omni-human] poll ${attempts} failed: ${pollRes.status}`)
        continue
      }

      const pollData = await pollRes.json()
      const status: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
      console.log(`[omni-human] poll ${attempts} status: ${status}`)

      if (status === 'completed' || status === 'success') {
        // Try common output paths
        videoUrl =
          pollData?.data?.output?.video ??
          pollData?.data?.output?.video_url ??
          pollData?.data?.output?.url ??
          pollData?.output?.video ??
          pollData?.output?.video_url ??
          null
        console.log('[omni-human] task completed, videoUrl:', videoUrl)
        break
      }

      if (status === 'failed' || status === 'error') {
        const errMsg = pollData?.data?.error ?? pollData?.error ?? 'unknown error'
        console.error('[omni-human] task failed:', errMsg)
        return NextResponse.json({
          success: false,
          error: `OmniHuman task failed: ${errMsg}`,
          videoUrl: null,
        }, { status: 502 })
      }

      // status is 'pending' or 'processing' — keep polling
    }

    if (!videoUrl) {
      console.error('[omni-human] timed out after', attempts, 'attempts')
      return NextResponse.json({
        success: false,
        error: `OmniHuman timed out after ${attempts * POLL_INTERVAL_MS / 1000}s`,
        videoUrl: null,
      }, { status: 504 })
    }

    // ── Step 3: Store videoUrl in projects.keyframe_url ───────────────────────
    if (projectId && videoUrl) {
      console.log('[omni-human] storing keyframe_url in projects, projectId:', projectId)
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        const { error: dbError } = await supabase
          .from('projects')
          .update({ keyframe_url: videoUrl })
          .eq('id', projectId)

        if (dbError) {
          console.error('[omni-human] DB update error:', dbError.message)
        } else {
          console.log('[omni-human] DB update OK: projects.keyframe_url =', videoUrl)
        }
      } catch (dbErr) {
        console.error('[omni-human] DB error:', dbErr instanceof Error ? dbErr.message : dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      videoUrl,
      taskId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[omni-human] FATAL error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
