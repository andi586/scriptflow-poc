import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * GET /api/admin/check-costs
 *
 * Checks balances for PiAPI and ElevenLabs.
 * Returns a summary of each service's balance and whether it's above the warning threshold.
 */
export async function GET() {
  const results: Record<string, unknown> = {}

  // ── PiAPI balance ─────────────────────────────────────────────────────────
  try {
    const piApiKey = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
    if (piApiKey) {
      // Try /account/balance first, fall back to /profile
      const endpoints = [
        'https://api.piapi.ai/api/v1/account/balance',
        'https://api.piapi.ai/api/v1/profile',
        'https://api.piapi.ai/api/v1/account',
      ]
      let piData: unknown = null
      let lastStatus = 0
      for (const url of endpoints) {
        const piRes = await fetch(url, { headers: { 'x-api-key': piApiKey } })
        lastStatus = piRes.status
        const rawText = await piRes.text()
        console.log(`[check-costs] PiAPI ${url} status=${piRes.status} raw:`, rawText.slice(0, 500))
        if (piRes.ok) {
          try { piData = JSON.parse(rawText) } catch { piData = { _raw: rawText } }
          break
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = piData as any
      const balance: number =
        d?.data?.balance ??
        d?.balance ??
        d?.data?.credit ??
        d?.credit ??
        d?.data?.remaining_credits ??
        d?.remaining_credits ??
        -1
      results.piapi = {
        balance,
        currency: 'points',
        ok: balance < 0 ? null : balance >= 10,
        lastStatus,
        raw: piData,
      }
    } else {
      results.piapi = { balance: null, currency: 'points', ok: null, error: 'API key not set' }
    }
  } catch (e) {
    results.piapi = { balance: null, currency: 'points', ok: null, error: e instanceof Error ? e.message : String(e) }
  }

  // ── ElevenLabs credits ────────────────────────────────────────────────────
  try {
    const elevenKey = process.env.ELEVENLABS_API_KEY
    if (elevenKey) {
      const elevenRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': elevenKey },
      })
      const elevenData = await elevenRes.json()
      console.log('[check-costs] ElevenLabs raw:', JSON.stringify(elevenData))
      const used: number = elevenData?.character_count ?? 0
      const limit: number = elevenData?.character_limit ?? 0
      const remaining = limit - used
      results.elevenlabs = {
        balance: remaining,
        used,
        limit,
        currency: 'credits',
        ok: remaining < 0 ? null : remaining >= 1000,
        raw: elevenData,
      }
    } else {
      results.elevenlabs = { balance: null, currency: 'credits', ok: null, error: 'API key not set' }
    }
  } catch (e) {
    results.elevenlabs = { balance: null, currency: 'credits', ok: null, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    ...results,
    lastChecked: new Date().toISOString(),
  })
}
