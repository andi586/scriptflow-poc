import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — OmniHuman takes 4-5 min

const PIAPI_BASE = 'https://api.piapi.ai/api/v1'

/**
 * POST /api/omnihuman-keyframe
 *
 * Waits for an OmniHuman task to complete (polls PiAPI up to 5 min),
 * then extracts the last frame of the resulting video using ffmpeg (server-side),
 * uploads the frame to Supabase Storage, and returns the public URL.
 *
 * This URL is used as `image_url` (start_image) for every Kling scene,
 * locking face + outfit across all shots.
 *
 * Body: { taskId: string, projectId: string }
 * Returns: { keyframeUrl: string } | { error: string }
 */
export async function POST(request: NextRequest) {
  console.log('[omnihuman-keyframe] ENTER', new Date().toISOString())

  try {
    const body = await request.json()
    const taskId = body.taskId as string | null
    const projectId = body.projectId as string | null

    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    if (!piApiKey) return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })

    // ── Step 1: Poll PiAPI until OmniHuman task completes (max 5 min) ─────────
    // OmniHuman fast_mode takes ~4-5 min; poll every 15s, up to 20 attempts = 5 min
    let videoUrl: string | null = null
    const MAX_ATTEMPTS = 20
    const POLL_INTERVAL_MS = 15_000

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // First check DB (webhook may have already delivered the result)
      try {
        const { data: jobRow } = await supabaseAdmin
          .from('omnihuman_jobs')
          .select('status, result_video_url')
          .eq('task_id', taskId)
          .maybeSingle()

        if (jobRow?.status === 'completed' && jobRow.result_video_url) {
          videoUrl = jobRow.result_video_url
          console.log('[omnihuman-keyframe] DB hit on attempt', attempt, 'videoUrl:', videoUrl)
          break
        }
        if (jobRow?.status === 'failed') {
          return NextResponse.json({ error: 'OmniHuman task failed' }, { status: 502 })
        }
      } catch (dbErr) {
        console.warn('[omnihuman-keyframe] DB check failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
      }

      // Fall back to PiAPI direct poll
      try {
        const pollRes = await fetch(`${PIAPI_BASE}/task/${taskId}`, {
          headers: { 'x-api-key': piApiKey },
          cache: 'no-store',
        })

        if (pollRes.ok) {
          const pollData = await pollRes.json()
          const rawStatus: string = pollData?.data?.status ?? pollData?.status ?? 'unknown'
          console.log(`[omnihuman-keyframe] attempt ${attempt} PiAPI status: ${rawStatus}`)

          if (rawStatus === 'completed' || rawStatus === 'success') {
            const output = pollData?.data?.output ?? pollData?.output ?? {}
            videoUrl =
              output?.video ??
              output?.video_url ??
              output?.url ??
              null

            if (videoUrl) {
              // Update DB in case webhook was missed
              try {
                await supabaseAdmin
                  .from('omnihuman_jobs')
                  .update({ status: 'completed', result_video_url: videoUrl, updated_at: new Date().toISOString() })
                  .eq('task_id', taskId)
              } catch {}
              break
            }
          }

          if (rawStatus === 'failed' || rawStatus === 'error') {
            return NextResponse.json({ error: 'OmniHuman task failed' }, { status: 502 })
          }
        }
      } catch (pollErr) {
        console.warn('[omnihuman-keyframe] PiAPI poll error (non-fatal):', pollErr instanceof Error ? pollErr.message : pollErr)
      }

      // Wait before next attempt (skip wait on last attempt)
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: 'OmniHuman task did not complete within 5 minutes' }, { status: 504 })
    }

    console.log('[omnihuman-keyframe] OmniHuman video ready:', videoUrl)

    // ── Step 2: Extract last frame from video using canvas (server-side) ──────
    // We download the video, then use ffmpeg via child_process to extract the last frame.
    // Fallback: if ffmpeg is unavailable, use the first frame via a different approach.
    let frameBuffer: Buffer | null = null
    let frameContentType = 'image/jpeg'

    try {
      // Download the video
      const videoRes = await fetch(videoUrl, { cache: 'no-store' })
      if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`)
      const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
      console.log('[omnihuman-keyframe] video downloaded, bytes:', videoBuffer.length)

      // Use ffmpeg to extract the last frame
      // ffmpeg -sseof -0.1 -i input.mp4 -frames:v 1 -f image2 -vcodec mjpeg output.jpg
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const { tmpdir } = await import('os')
      const { join } = await import('path')
      const { writeFile, readFile, unlink } = await import('fs/promises')

      const execFileAsync = promisify(execFile)
      const tmpDir = tmpdir()
      const inputPath = join(tmpDir, `omnihuman_${taskId}_input.mp4`)
      const outputPath = join(tmpDir, `omnihuman_${taskId}_frame.jpg`)

      // Write video to temp file
      await writeFile(inputPath, videoBuffer)

      try {
        // Extract last frame: seek to 0.1s before end
        await execFileAsync('ffmpeg', [
          '-sseof', '-0.1',
          '-i', inputPath,
          '-frames:v', '1',
          '-f', 'image2',
          '-vcodec', 'mjpeg',
          '-y',
          outputPath,
        ])
        frameBuffer = await readFile(outputPath)
        frameContentType = 'image/jpeg'
        console.log('[omnihuman-keyframe] ffmpeg extracted last frame, bytes:', frameBuffer.length)
      } catch (ffmpegErr) {
        console.warn('[omnihuman-keyframe] ffmpeg last-frame failed, trying first frame:', ffmpegErr instanceof Error ? ffmpegErr.message : ffmpegErr)
        // Fallback: extract first frame
        try {
          await execFileAsync('ffmpeg', [
            '-i', inputPath,
            '-frames:v', '1',
            '-f', 'image2',
            '-vcodec', 'mjpeg',
            '-y',
            outputPath,
          ])
          frameBuffer = await readFile(outputPath)
          frameContentType = 'image/jpeg'
          console.log('[omnihuman-keyframe] ffmpeg extracted first frame (fallback), bytes:', frameBuffer.length)
        } catch (ffmpegErr2) {
          console.warn('[omnihuman-keyframe] ffmpeg first-frame also failed:', ffmpegErr2 instanceof Error ? ffmpegErr2.message : ffmpegErr2)
        }
      }

      // Cleanup temp files
      try { await unlink(inputPath) } catch {}
      try { await unlink(outputPath) } catch {}
    } catch (downloadErr) {
      console.warn('[omnihuman-keyframe] video download/frame extraction failed:', downloadErr instanceof Error ? downloadErr.message : downloadErr)
    }

    // ── Step 3: Upload frame to Supabase Storage ──────────────────────────────
    let keyframeUrl: string | null = null

    if (frameBuffer && frameBuffer.length > 0) {
      const ext = frameContentType.includes('png') ? 'png' : 'jpg'
      const framePath = `star-mode/${projectId}/omnihuman_keyframe.${ext}`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('character-images')
        .upload(framePath, frameBuffer, { contentType: frameContentType, upsert: true })

      if (uploadError) {
        console.error('[omnihuman-keyframe] Supabase upload error:', uploadError.message)
      } else {
        const { data: pub } = supabaseAdmin.storage
          .from('character-images')
          .getPublicUrl(framePath)
        keyframeUrl = pub?.publicUrl ?? null
        console.log('[omnihuman-keyframe] keyframe uploaded:', keyframeUrl)
      }
    }

    // ── Step 4: If frame extraction failed, fall back to the video thumbnail ──
    // Use the OmniHuman video URL itself as a last resort (Kling accepts video URLs as image_url)
    if (!keyframeUrl) {
      console.warn('[omnihuman-keyframe] frame extraction failed — falling back to video URL as keyframe')
      keyframeUrl = videoUrl
    }

    // ── Step 5: Save keyframe URL to omnihuman_jobs row ───────────────────────
    try {
      await supabaseAdmin
        .from('omnihuman_jobs')
        .update({ keyframe_url: keyframeUrl, updated_at: new Date().toISOString() } as any)
        .eq('task_id', taskId)
    } catch (dbErr) {
      console.warn('[omnihuman-keyframe] DB keyframe_url update failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    // ── Step 6: Save keyframe URL to projects table ───────────────────────────
    try {
      await supabaseAdmin
        .from('projects')
        .update({ keyframe_url: keyframeUrl } as any)
        .eq('id', projectId)
    } catch (dbErr) {
      console.warn('[omnihuman-keyframe] projects keyframe_url update failed (non-fatal):', dbErr instanceof Error ? dbErr.message : dbErr)
    }

    console.log('[omnihuman-keyframe] DONE keyframeUrl:', keyframeUrl)
    return NextResponse.json({ success: true, keyframeUrl, videoUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[omnihuman-keyframe] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
