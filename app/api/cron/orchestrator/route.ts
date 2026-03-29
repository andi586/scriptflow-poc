import { NextRequest, NextResponse } from 'next/server'
import { progressEpisodeOrchestration } from '@/lib/orchestrators/episode-orchestrator'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return NextResponse.json({ success: false, error: 'Missing CRON_SECRET' }, { status: 500 })
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    await progressEpisodeOrchestration()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
