import { NextRequest, NextResponse } from 'next/server'
import { runCognitiveCore } from '@/app/lib/cognitive-core'
import { buildExecutionPlan as buildExecutionPlanV2 } from '@/app/lib/director-v2'
import { generateHookShot } from '@/app/lib/hook-engine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const USE_DIRECTOR_V2 = true

/**
 * POST /api/generate-script
 * Body: { template: string, personalNote?: string }
 * Returns: { shots: ExecutionPlan.pipeline, storyState, directionPlan, hook? }
 */
export async function POST(request: NextRequest) {
  try {
    const { template, personalNote } = await request.json()
    console.log('[generate-script] received request, story length:', (template ?? '').length, 'template:', template)

    if (!template) {
      return NextResponse.json({ error: 'template is required' }, { status: 400 })
    }

    const story = personalNote ?? template

    const output = await runCognitiveCore(story, template)

    console.log('[generate-script] CognitiveCore complete. Shots:', output.executionPlan.pipeline.length, 'category:', output.story_category)

    // ── Director V2 + Hook Engine integration ─────────────────────────────
    const primaryEmotion = output.directionPlan.shots[0]?.emotion
      ?? output.storyState.tensionCurve[0]
      ?? 'neutral'

    let hook = null
    try {
      const planV2 = USE_DIRECTOR_V2
        ? buildExecutionPlanV2(primaryEmotion)
        : null

      if (planV2 && planV2.shots.length > 0) {
        hook = generateHookShot(planV2.shots[0], primaryEmotion)
        console.log('[generate-script] hook generated via director-v2:', hook.text)
      }
    } catch (hookErr) {
      // Non-fatal: hook generation failure does not break existing pipeline
      console.warn('[generate-script] hook generation failed (non-fatal):', hookErr instanceof Error ? hookErr.message : hookErr)
    }
    // ── End Director V2 + Hook Engine ─────────────────────────────────────

    return NextResponse.json({
      shots: output.executionPlan.pipeline,
      storyState: output.storyState,
      directionPlan: output.directionPlan,
      story_category: output.story_category,
      ...(hook ? { hook } : {}),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-script] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
