import { NextRequest, NextResponse } from 'next/server'
import { runDirector } from '@/app/lib/nel-director'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/generate-script
 * Body: { template: string, personalNote?: string }
 * Returns: { shots: Shot[], title: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { template, personalNote } = await request.json()

    if (!template) {
      return NextResponse.json({ error: 'template is required' }, { status: 400 })
    }

    const story = personalNote ?? template

    const directorOutput = await runDirector(story, template)

    console.log('[generate-script] Director output:', directorOutput.title, 'shots:', directorOutput.shots.length)
    return NextResponse.json({ shots: directorOutput.shots, title: directorOutput.title })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-script] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
