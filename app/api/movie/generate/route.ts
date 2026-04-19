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

    // Step 1: Get digital twin
    const { data: twin } = await supabase
      .from('digital_twins')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!twin) {
      return NextResponse.json({ error: 'Digital twin not found. Please create your digital twin first.' }, { status: 400 })
    }

    console.log('[movie/generate] twin found:', twin.id)

    // Step 2: Call Cognitive Core
    const scriptRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story, template: 'Dear Mom' })
    })
    const scriptData = await scriptRes.json()
    const shots = scriptData?.directionPlan?.shots ?? []

    console.log('[movie/generate] Cognitive Core shots:', shots.length)

    // Step 3: Determine shot count by tier
    const shotCount = tier === '30s' ? 4 : tier === '60s' ? 6 : 9
    const selectedShots = shots.slice(0, Math.min(shotCount, 6))

    // Step 4: Build multi_shots prompts
    // NEL translates director language to Kling language
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multiShots = selectedShots.map((shot: any) => {
      const shotType = shot.shotType === 'face' ? 'close-up' : 'wide cinematic'
      const camera = shot.cameraMovement || 'static'
      const emotion = shot.emotion || 'contemplative'
      const dialogue = shot.dialogue ? `character @image_1 says: "${shot.dialogue}"` : ''
      const scene = shot.scenePrompt || shot.description || ''
      const lighting = shot.lightingMood || 'cinematic'
      const silence = shot.silence ? 'moment of silence' : ''

      const prompt = shot.shotType === 'face'
        ? `${shotType} ${camera} shot, character @image_1 ${shot.description}, ${dialogue}, emotion: ${emotion}, ${silence}, ${lighting} lighting, cinematic 9:16`
        : `${shotType} ${camera} shot, ${scene}, emotion: ${emotion}, ${lighting} lighting, no people, cinematic 9:16`

      return {
        prompt: prompt.trim(),
        duration: shot.duration || 5
      }
    })

    console.log('[movie/generate] multi_shots:', JSON.stringify(multiShots).slice(0, 300))

    // Step 5: Create movie record
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .insert({
        user_id: userId,
        status: 'pending',
        tier,
        story_input: story,
        twin_photo_url: twin.frame_url_mid,
        twin_video_url: twin.source_video_url
      })
      .select()
      .single()

    if (movieError) throw new Error('Failed to create movie: ' + movieError.message)

    console.log('[movie/generate] movie created:', movie.id)

    // Step 6: Call Kling 3.0 Omni - ONE API call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const klingBody: any = {
      model: 'kling',
      task_type: 'omni_video_generation',
      input: {
        version: '3.0',
        resolution: '720p',
        aspect_ratio: '9:16',
        enable_audio: true,
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

    // Add digital twin references
    if (twin.frame_url_mid) {
      klingBody.input.images = [twin.frame_url_mid]
    }
    if (twin.source_video_url) {
      klingBody.input.video = twin.source_video_url
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

    // Step 7: Update movie with task_id
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
