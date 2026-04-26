import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count, error } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    if (error) throw new Error(error.message)

    const dailyLimit = parseInt(process.env.DAILY_MOVIE_LIMIT || '10', 10)

    // Check PiAPI balance
    let piapiBalance: number | null = null
    try {
      const piapiRes = await fetch('https://api.piapi.ai/api/v1/user/balance', {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY! }
      })
      if (piapiRes.ok) {
        const piapiData = await piapiRes.json()
        piapiBalance = piapiData?.data?.balance ?? piapiData?.balance ?? null
      }
    } catch (balErr) {
      console.warn('[cost-check] PiAPI balance fetch failed:', balErr)
    }

    console.log('[cost-check] daily count:', count, '/ limit:', dailyLimit, '| PiAPI balance:', piapiBalance)

    return NextResponse.json({
      dailyCount: count,
      dailyLimit,
      limitReached: (count ?? 0) >= dailyLimit,
      piapiBalance,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cost-check] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
