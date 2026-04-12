import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/send
 * Body: { jobId: string, videoUrl: string }
 * Sends a Web Push notification to the subscriber for this job.
 */
export async function POST(request: NextRequest) {
  try {
    const { jobId, videoUrl } = await request.json()

    if (!jobId || !videoUrl) {
      return NextResponse.json({ error: 'jobId and videoUrl are required' }, { status: 400 })
    }

    const vapidPublicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    const vapidEmail      = process.env.VAPID_EMAIL ?? 'mailto:jiming.liu2@icloud.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('[push/send] VAPID keys not configured — skipping push')
      return NextResponse.json({ success: false, reason: 'VAPID keys not configured' })
    }

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get subscription for this job
    const { data: rows, error: fetchErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('job_id', jobId)

    if (fetchErr) {
      console.error('[push/send] DB fetch error:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      console.log('[push/send] No subscriptions found for jobId:', jobId)
      return NextResponse.json({ success: true, sent: 0 })
    }

    const payload = JSON.stringify({
      title: '🎬 Your Movie is Ready!',
      body: 'Tap to watch your movie now',
      url: `/app-flow?autoplay=${encodeURIComponent(videoUrl)}`,
    })

    let sent = 0
    for (const row of rows) {
      try {
        const pushSubscription = {
          endpoint: row.endpoint,
          keys: row.keys,
        }
        await webpush.sendNotification(pushSubscription, payload)
        sent++
        console.log('[push/send] Notification sent for jobId:', jobId)
      } catch (pushErr) {
        console.warn('[push/send] Push failed for endpoint:', row.endpoint, pushErr instanceof Error ? pushErr.message : pushErr)
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[push/send] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
