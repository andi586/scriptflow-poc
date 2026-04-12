import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SERVICES = [
  { name: 'PiAPI/Kling', key: 'piapi', warning: 10 },
  { name: 'ElevenLabs', key: 'elevenlabs', warning: 1000 },
]

/**
 * GET /api/cron/check-costs
 *
 * Daily cron (9am UTC) — checks service balances and logs warnings
 * when any service falls below its threshold.
 */
export async function GET() {
  console.log('[cron/check-costs] Running daily cost check', new Date().toISOString())

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const res = await fetch(`${baseUrl}/api/admin/check-costs`)
    if (!res.ok) {
      console.error('[cron/check-costs] check-costs API returned', res.status)
      return NextResponse.json({ error: 'check-costs API failed' }, { status: 500 })
    }

    const data = await res.json()
    console.log('[cron/check-costs] Results:', JSON.stringify(data))

    const warnings: string[] = []

    for (const svc of SERVICES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (data as any)[svc.key]
      if (!result) continue

      const balance = result.balance ?? -1
      const currency = result.currency ?? ''

      if (result.error) {
        console.warn(`[cron/check-costs] ⚠️  ${svc.name}: ERROR — ${result.error}`)
        warnings.push(`${svc.name}: error (${result.error})`)
      } else if (balance >= 0 && balance < svc.warning) {
        console.warn(`[cron/check-costs] ⚠️  ${svc.name}: LOW BALANCE — ${balance} ${currency} (threshold: ${svc.warning})`)
        warnings.push(`${svc.name}: ${balance} ${currency} (below ${svc.warning})`)
      } else {
        console.log(`[cron/check-costs] ✅ ${svc.name}: ${balance} ${currency}`)
      }
    }

    if (warnings.length > 0) {
      console.error('[cron/check-costs] 🚨 COST WARNINGS:', warnings.join(' | '))
    } else {
      console.log('[cron/check-costs] All services OK')
    }

    return NextResponse.json({
      ok: warnings.length === 0,
      warnings,
      lastChecked: data.lastChecked,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/check-costs] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
