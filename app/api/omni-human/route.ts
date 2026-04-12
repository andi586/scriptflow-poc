import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'

/**
 * OmniHuman API wrapper — fire and forget
 *
 * POST /api/omni-human
 * Body: { imageUrl, audioUrl, prompt?, projectId? }
 *
 * Flow:
 * 1. Optionally convert webm audio to mp3 via Railway
 * 2. Submit task to PiAPI OmniHuman
 * 3. Store taskId in omnihuman_jobs table with status 'pending'
 * 4. Return immediately with { success: true, taskId }
 *
 * Polling is handled by GET /api/omni-human/poll?taskId=xxx
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

    // ── Submit task to PiAPI ──────────────────────────────────────────────────
    const taskPayload = {
      model: 'omni-human',
      task_type: 'omni-human-1.5',
      input: {
        image_url: imageUrl,
        audio_url: finalAudioUrl,
        prompt: prompt ?? 'person speaks naturally, cinematic lighting, soft beauty light, smooth skin, professional film look, warm color grade',
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

    // ── Store taskId in omnihuman_jobs ────────────────────────────────────────
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const { error: insertError } = await supabase
        .from('omnihuman_jobs')
        .insert({
          task_id: taskId,
          project_id: projectId ?? null,
          status: 'pending',
          image_url: imageUrl ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      if (insertError) {
        console.warn('[omni-human] omnihuman_jobs insert error (non-fatal):', insertError.message)
      } else {
        console.log('[omni-human] omnihuman_jobs row created for taskId:', taskId)
      }
    } catch (dbErr) {
      console.warn('[omni-human] DB insert failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    // Return immediately — polling handled by /api/omni-human/poll
    return NextResponse.json({
      success: true,
      taskId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[omni-human] FATAL error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
