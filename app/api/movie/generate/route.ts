import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { story, tier = '60s', userId } = await req.json()

    if (!story) {
      return NextResponse.json({ error: 'Story is required' }, { status: 400 })
    }

    console.log('[movie/generate] story:', story, 'tier:', tier)

    // Step 1: Get digital twin photo (query by id, since frontend passes twinId as userId)
    console.log('[movie/generate] userId received:', userId)
    console.log('[movie/generate] looking for twin id:', userId)
    const { data: twin } = await supabase
      .from('digital_twins')
      .select('id, frame_url_mid')
      .eq('id', userId)
      .single()

    if (!twin) {
      return NextResponse.json({ error: 'Digital twin not found. Please create your digital twin first.' }, { status: 400 })
    }

    console.log('[movie/generate] twin found:', twin.id)

    // Step 2: Call Cognitive Core for shot plan
    const scriptRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story, template: 'Dear Mom' })
    })
    const scriptData = await scriptRes.json()
    const shots = scriptData?.directionPlan?.shots ?? []

    console.log('[movie/generate] Cognitive Core shots:', shots.length)

    // Tier config: total duration must not exceed 15s
    const tierConfig: Record<string, { shots: number; duration: number }> = {
      '30s': { shots: 4, duration: 3 }, // 4 × 3 = 12s
      '60s': { shots: 6, duration: 2 }, // 6 × 2 = 12s
      '90s': { shots: 6, duration: 2 }, // 6 × 2 = 12s (first call)
    }
    const config = tierConfig[tier] ?? tierConfig['60s']
    const selectedShots = shots.slice(0, config.shots)

    // Force override duration — ALWAYS use tier duration, ignore Cognitive Core duration
    const TIER_DURATION = { '30s': 3, '60s': 2, '90s': 2 }
    const forcedDuration = TIER_DURATION[tier as keyof typeof TIER_DURATION] || 3

    // Build multi_shots prompts from shot plan
    const cameraMovements = [
      'slow dolly in',
      'gentle push forward',
      'subtle pull back',
      'slow pan left',
      'micro drift right',
      'static with slight breathing',
    ]

    const sceneEnvironments = [
      'quiet bedroom with morning light through curtains',
      'kitchen table with two empty chairs',
      'living room with old photographs on wall',
      'window with rain drops, blurred city outside',
      'hallway with single light casting long shadow',
      'garden bench empty in late afternoon',
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildPrompt = (shot: any, shotIndex: number, _totalShots: number): string => {
      const movement = cameraMovements[shotIndex % cameraMovements.length]
      const environment = sceneEnvironments[shotIndex % sceneEnvironments.length]

      if (shot.shotType === 'face') {
        const emotion = shot.emotion || 'contemplative'
        const dialogue = shot.dialogue || ''

        const dialogueInstruction = dialogue
          ? `character speaks quietly with restraint: "${dialogue}", voice barely above whisper, emotion held back`
          : 'character in silence, emotion visible only in subtle facial movements'

        return `Cinematic 9:16, ${movement}, close-up portrait, character @image_1, ${dialogueInstruction}, emotion: ${emotion} but controlled and understated, soft cinematic lighting, shallow depth of field, smooth dissolve transition`
      } else {
        return `Cinematic 9:16, ${movement}, ${environment}, no people, empty space holding memory, emotion: ${shot.emotion || 'melancholic'}, natural light with soft shadows, smooth dissolve transition into next shot`
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multiShots = selectedShots.map((shot: any, index: number) => ({
      prompt: buildPrompt(shot, index, selectedShots.length),
      duration: forcedDuration, // ALWAYS use this, ignore shot.duration from Cognitive Core
    }))

    console.log('[movie/generate] multi_shots:', JSON.stringify(multiShots).slice(0, 300))
    console.log('[movie/generate] multiShots durations:', multiShots.map((s: { duration: number }) => s.duration))
    console.log('[movie/generate] total duration:', multiShots.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0))

    // Step 3: Create movie record
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .insert({
        user_id: userId,
        status: 'pending',
        tier,
        story_input: story,
        twin_photo_url: twin.frame_url_mid
      })
      .select()
      .single()

    if (movieError) throw new Error('Failed to create movie: ' + movieError.message)

    console.log('[movie/generate] movie created:', movie.id)

    // Step 4: Call Kling 3.0 Omni - ONE API call with native audio
    const klingBody = {
      model: 'kling',
      task_type: 'omni_video_generation',
      input: {
        version: '3.0',
        resolution: '720p',
        aspect_ratio: '9:16',
        enable_audio: true,
        images: twin.frame_url_mid ? [twin.frame_url_mid] : undefined,
        multi_shots: multiShots
      },
      config: {
        service_mode: 'public',
        webhook_config: {
          endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/piapi`,
          secret: ''
        }
      }
    }

    const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PIAPI_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(klingBody)
    })

    const klingData = await klingRes.json()
    const taskId = klingData?.data?.task_id

    console.log('[movie/generate] Kling task_id:', taskId)

    if (!taskId) {
      throw new Error('Kling task creation failed: ' + JSON.stringify(klingData).slice(0, 200))
    }

    // Step 5: Update movie with task_id
    await supabase
      .from('movies')
      .update({
        kling_task_id: taskId,
        status: 'processing'
      })
      .eq('id', movie.id)

    return NextResponse.json({
      success: true,
      movieId: movie.id,
      taskId,
      tier,
      message: 'Your movie is being created. This takes 2-5 minutes.'
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[movie/generate] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
