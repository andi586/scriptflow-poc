import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COST_PER_JOB = {
  omniHuman: 0.04,
  kling: 0.10,
  elevenLabs: 0.02,
  shotstack: 0.05,
}

const DAILY_ALERT_THRESHOLD = 30

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)

  // Count omnihuman_jobs created today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: jobCount, error } = await db
    .from('omnihuman_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

  if (error) {
    console.error('[check-costs] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = jobCount ?? 0

  // Estimate today's variable cost
  const omniCost = count * COST_PER_JOB.omniHuman
  const klingCost = count * COST_PER_JOB.kling
  const elevenCost = count * COST_PER_JOB.elevenLabs
  const shotstackCost = count * COST_PER_JOB.shotstack
  const totalCost = omniCost + klingCost + elevenCost + shotstackCost

  const result = {
    date: todayStart.toISOString().split('T')[0],
    jobCount: count,
    breakdown: {
      omniHuman: `$${omniCost.toFixed(2)}`,
      kling: `$${klingCost.toFixed(2)}`,
      elevenLabs: `$${elevenCost.toFixed(2)}`,
      shotstack: `$${shotstackCost.toFixed(2)}`,
    },
    totalVariableCost: `$${totalCost.toFixed(2)}`,
    alert: totalCost > DAILY_ALERT_THRESHOLD,
  }

  if (totalCost > DAILY_ALERT_THRESHOLD) {
    console.warn(`[check-costs] ALERT: Daily cost exceeded $${DAILY_ALERT_THRESHOLD}:`, `$${totalCost.toFixed(2)}`, `(${count} jobs)`)
  } else {
    console.log(`[check-costs] Daily cost OK: $${totalCost.toFixed(2)} (${count} jobs)`)
  }

  return NextResponse.json(result)
}
