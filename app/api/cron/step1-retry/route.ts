import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/step1-retry
 * Step 1: Retry pending shots that are missing task IDs
 */

export async function GET() {
  const start = Date.now()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const piApiKey    = process.env.PIAPI_API_KEY ?? process.env.KLING_API_KEY
  const elevenKey   = process.env.ELEVENLABS_API_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  if (!piApiKey) {
    return NextResponse.json({ error: 'PIAPI_API_KEY not configured' }, { status: 500 })
  }

  const db = createClient(supabaseUrl, serviceKey)
  const log: string[] = []
  let processed = 0

  console.log('[step1-retry] Starting...')

  // Daily budget check: count omnihuman_jobs created today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayJobCount } = await db
    .from('omnihuman_jobs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString())

  const DAILY_BUDGET = 50
  if ((todayJobCount ?? 0) >= DAILY_BUDGET) {
    log.push(`[step1] DAILY BUDGET REACHED: ${todayJobCount}/${DAILY_BUDGET} jobs today — skipping new submissions`)
    return NextResponse.json({ step: 1, processed, elapsed: Date.now() - start, log })
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: pendingShots } = await db
    .from('movie_shots')
    .select('*')
    .eq('status', 'pending')
    .or(`omni_task_id.is.null,kling_task_id.is.null`)
    .or(`submitted_at.is.null,submitted_at.lt.${fiveMinAgo}`)
    .limit(10)

  log.push(`[step1] pending shots to retry: ${pendingShots?.length ?? 0} (today: ${todayJobCount}/${DAILY_BUDGET})`)

  for (const shot of pendingShots ?? []) {
    try {
      const retryCount = shot.retry_count ?? 0
      if (retryCount >= 3) {
        await db.from('movie_shots').update({ status: 'failed' }).eq('id', shot.id)
        log.push(`[step1] shot ${shot.id} exceeded retries → failed`)
        continue
      }

      let omniTaskId: string | null = shot.omni_task_id ?? null
      let klingTaskId: string | null = shot.kling_task_id ?? null

      // Face shots: TTS → OmniHuman
      if (shot.shot_type === 'face' && !omniTaskId && elevenKey && shot.audio_url) {
        await new Promise(r => setTimeout(r, 2000))
        const omniRes = await fetch('https://api.piapi.ai/api/v1/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
          body: JSON.stringify({
            model: 'omni-human',
            task_type: 'omni-human-1.5',
            input: { image_url: shot.image_url ?? shot.frame_url, audio_url: shot.audio_url, prompt: 'person speaks naturally, cinematic' },
          }),
        })
        if (omniRes.ok) {
          const omniData = await omniRes.json()
          omniTaskId = omniData?.data?.task_id ?? omniData?.task_id ?? null
          log.push(`[step1] shot ${shot.id} re-submitted OmniHuman: ${omniTaskId}`)
        }
      }

      // All shots: Kling
      if (!klingTaskId) {
        await new Promise(r => setTimeout(r, 2000))
        const scenePrompt = shot.scene ?? 'empty cinematic scene, no people, no humans, dramatic lighting'
        const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': piApiKey },
          body: JSON.stringify({
            model: 'kling',
            task_type: 'video_generation',
            input: {
              prompt: scenePrompt,
              negative_prompt: 'people, humans, figures, person, man, woman, face, body, character',
              version: '3.0',
              mode: 'pro',
              duration: shot.duration ?? 5,
              aspect_ratio: '9:16',
              enable_audio: true,
            },
          }),
        })
        if (klingRes.ok) {
          const klingData = await klingRes.json()
          klingTaskId = klingData?.data?.task_id ?? null
          log.push(`[step1] shot ${shot.id} re-submitted Kling: ${klingTaskId}`)
        }
      }

      await db.from('movie_shots').update({
        omni_task_id: omniTaskId,
        kling_task_id: klingTaskId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        retry_count: retryCount + 1,
      }).eq('id', shot.id)
      processed++
    } catch (e) {
      log.push(`[step1] error for shot ${shot.id}: ${e instanceof Error ? e.message : e}`)
    }
  }

  return NextResponse.json({ step: 1, processed, elapsed: Date.now() - start, log })
}
