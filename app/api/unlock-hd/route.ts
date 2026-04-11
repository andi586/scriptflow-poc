import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Simple in-memory IP rate limiter (per-process, resets on cold start) ──────
// Limit: 5 requests per IP per hour
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }

  entry.count += 1
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

/**
 * POST /api/unlock-hd
 *
 * Receives { imageUrl, audioUrl, firstLine } from the frontend after Stripe
 * payment success. Verifies payment (isPaid hardcoded true for now), then
 * proxies to /api/be-the-star/submit and returns the result.
 *
 * Idempotency: if an omnihuman_jobs row already exists for the same
 * (imageUrl, firstLine) pair, return the existing taskId immediately.
 *
 * Rate limit: 5 requests per IP per hour.
 */
export async function POST(request: NextRequest) {
  console.log('[unlock-hd] ENTER', new Date().toISOString())

  // ── IP rate limiting ───────────────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const { allowed, remaining } = checkRateLimit(ip)
  if (!allowed) {
    console.warn('[unlock-hd] rate limit exceeded for IP:', ip)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '3600',
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { imageUrl, audioUrl, firstLine } = body as {
      imageUrl?: string
      audioUrl?: string | null
      firstLine?: string
    }

    if (!imageUrl) return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    if (!firstLine) return NextResponse.json({ error: 'firstLine is required' }, { status: 400 })

    // ── Payment gate (hardcoded true for now) ─────────────────────────────────
    const isPaid = true
    if (!isPaid) {
      return NextResponse.json({ error: 'Payment required' }, { status: 402 })
    }

    // ── Idempotency check: look for existing job with same imageUrl+firstLine ──
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey)

    const idempotencyKey = `${imageUrl}::${firstLine}`

    const { data: existingJob } = await supabase
      .from('omnihuman_jobs')
      .select('task_id, status, result_video_url')
      .eq('idempotency_key', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingJob) {
      console.log('[unlock-hd] idempotency hit — returning existing job:', existingJob.task_id)
      console.log('[analytics] unlock_hd_idempotency_hit', { taskId: existingJob.task_id })
      return NextResponse.json(
        {
          success: true,
          taskId: existingJob.task_id,
          status: existingJob.status,
          result_video_url: existingJob.result_video_url ?? null,
          idempotent: true,
        },
        {
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': String(remaining),
          },
        }
      )
    }

    console.log('[unlock-hd] payment verified, forwarding to /api/be-the-star/submit')
    console.log('[analytics] unlock_hd_started', { imageUrl: imageUrl.slice(-40), firstLine: firstLine.slice(0, 30) })

    // ── Forward to /api/be-the-star/submit ────────────────────────────────────
    const baseUrl = request.nextUrl.origin
    const submitRes = await fetch(`${baseUrl}/api/be-the-star/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, audioUrl, firstLine }),
    })

    const submitData = await submitRes.json()

    if (!submitRes.ok) {
      console.error('[unlock-hd] submit failed:', submitRes.status, submitData)
      return NextResponse.json(
        { error: submitData.error ?? 'Submit failed' },
        { status: submitRes.status }
      )
    }

    const taskId: string = submitData.taskId

    // ── Write idempotency_key to the omnihuman_jobs row ───────────────────────
    if (taskId) {
      const { error: updateErr } = await supabase
        .from('omnihuman_jobs')
        .update({ idempotency_key: idempotencyKey })
        .eq('task_id', taskId)

      if (updateErr) {
        console.warn('[unlock-hd] failed to write idempotency_key (non-fatal):', updateErr.message)
      }
    }

    console.log('[analytics] unlock_hd_submitted', { taskId })
    console.log('[unlock-hd] submit success, taskId:', taskId)

    return NextResponse.json(submitData, {
      headers: {
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(remaining),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[unlock-hd] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
