import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * Body: { subscription: PushSubscription, jobId: string }
 * Stores the push subscription in Supabase for later notification.
 */
export async function POST(request: NextRequest) {
  try {
    const { subscription, jobId } = await request.json()

    if (!subscription?.endpoint || !jobId) {
      return NextResponse.json({ error: 'subscription and jobId are required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        job_id: jobId,
        endpoint: subscription.endpoint,
        keys: subscription.keys ?? {},
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('[push/subscribe] DB insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[push/subscribe] Subscription stored for jobId:', jobId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[push/subscribe] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
