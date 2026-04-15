import { NextRequest, NextResponse } from 'next/server'
import { runCognitiveCore } from '@/app/lib/cognitive-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/generate-script
 * Body: { template: string, personalNote?: string }
 * Returns: { shots: ExecutionPlan.pipeline, storyState, directionPlan }
 */
export async function POST(request: NextRequest) {
  try {
    const { template, personalNote } = await request.json()

    if (!template) {
      return NextResponse.json({ error: 'template is required' }, { status: 400 })
    }

    const story = personalNote ?? template

    const output = await runCognitiveCore(story, template)

    console.log('[generate-script] CognitiveCore complete. Shots:', output.executionPlan.pipeline.length)
    return NextResponse.json({
      shots: output.executionPlan.pipeline,
      storyState: output.storyState,
      directionPlan: output.directionPlan,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-script] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
