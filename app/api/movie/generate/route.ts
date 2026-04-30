import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export const maxDuration = 120

// Configure fal.ai
fal.config({ credentials: process.env.FAL_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { story, tier = '60s', userId, additional_images, story_category } = await req.json()

    if (!story) {
      return NextResponse.json({ error: 'Story is required' }, { status: 400 })
    }

    console.log('[movie/generate] story:', story, 'tier:', tier)

    // ── Daily cost guard ──────────────────────────────────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: dailyCount } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
    const dailyLimit = parseInt(process.env.DAILY_MOVIE_LIMIT || '10', 10)
    console.log('[cost-guard] daily count:', dailyCount, '/ limit:', dailyLimit)
    if ((dailyCount ?? 0) >= dailyLimit) {
      return NextResponse.json({ error: 'Daily limit reached. Please try again tomorrow.' }, { status: 429 })
    }

    // ── PiAPI balance log ─────────────────────────────────────────────────────
    try {
      const balRes = await fetch('https://api.piapi.ai/api/v1/user/balance', {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY! }
      })
      if (balRes.ok) {
        const balData = await balRes.json()
        const balance = balData?.data?.balance ?? balData?.balance ?? 'unknown'
        console.log('[cost-guard] PiAPI balance:', balance)
      }
    } catch (balErr) {
      console.warn('[cost-guard] PiAPI balance check failed (non-fatal):', balErr)
    }
    // ── End cost guard ────────────────────────────────────────────────────────

    // Step 1: Get digital twin photo (query by id, since frontend passes twinId as userId)
    console.log('[movie/generate] userId received:', userId)
    console.log('[movie/generate] looking for twin id:', userId)
    const { data: twin } = await supabase
      .from('digital_twins')
      .select('id, frame_url_mid, frame_url_front')
      .eq('id', userId)
      .single()

    if (!twin) {
      return NextResponse.json({ error: 'Digital twin not found. Please create your digital twin first.' }, { status: 400 })
    }

    console.log('[movie/generate] twin found:', twin.id)
    console.log('[movie/generate] twin photo:', twin?.frame_url_front)

    // Step 2: Call Cognitive Core for shot plan
    const scriptRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: story, personalNote: story })
    })
    const scriptData = await scriptRes.json()
    console.log('[DEBUG scriptData]', scriptData)
    console.log('[DEBUG shots]', scriptData?.shots)
    console.log('[DEBUG directionPlan]', scriptData?.directionPlan)
    console.log('[DEBUG hook]', scriptData?.hook)

    const shots = scriptData?.directionPlan?.shots ?? []
    const archetype = scriptData?.directionPlan?.archetype ?? scriptData?.archetype ?? null
    const hookData = scriptData?.hook ?? null

    console.log('[movie/generate] Cognitive Core shots:', shots.length, 'archetype:', archetype, 'hook:', !!hookData)

    // Tier config
    const tierConfig: Record<string, { shots: number; duration: number }> = {
      '30s': { shots: 4, duration: 6 },
      '60s': { shots: 6, duration: 8 },
      '90s': { shots: 8, duration: 8 },
    }
    const config = tierConfig[tier] ?? tierConfig['60s']
    const selectedShots = shots.slice(0, config.shots)

    // Force override duration — use tier duration from config
    const forcedDuration = config.duration

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

    const hasCastPhotos = Array.isArray(additional_images) && additional_images.length > 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildPrompt = (shot: any, shotIndex: number, _totalShots: number): string => {
    if (shot.klingPrompt) { shot = { ...shot, klingPrompt: shot.klingPrompt.split("\nActor")[0].split("\nCinematic")[0].trim() } }
      const movement = cameraMovements[shotIndex % cameraMovements.length]
      const environment = sceneEnvironments[shotIndex % sceneEnvironments.length]

      if (shot.shotType === 'face') {
        const emotion = shot.emotion || 'contemplative'
        const dialogue = shot.dialogue || ''
        const frameType = shot.frameType || shot.type || 'close-up'
        const cameraMovement = shot.cameraMovement || movement
        const lighting = shot.lighting || 'soft cinematic'
        const visualDesc = shot.visualDescription || shot.description || ''

        const dialogueInstruction = dialogue
          ? `character speaks quietly with restraint: "${dialogue}", voice barely above whisper, emotion held back`
          : 'character in silence, emotion visible only in subtle facial movements'

        return `Cinematic 9:16, ${frameType}, ${cameraMovement}, character @image_1, ${visualDesc ? visualDesc + ', ' : ''}${dialogueInstruction}, emotion: ${emotion} but controlled and understated, ${lighting} lighting, shallow depth of field, smooth dissolve transition`
      } else {
        // Scene shot
        const petRef = (story_category === 'pet' && hasCastPhotos) ? '@image_2 ' : ''
        const frameType = shot.frameType || shot.type || 'wide'
        const cameraMovement = shot.cameraMovement || movement
        const lighting = shot.lighting || 'natural'
        const rawDesc = shot.scenePrompt || shot.visualDescription || shot.description || environment
        const visualDesc = rawDesc.length > 150 ? rawDesc.substring(0, 150) : rawDesc

        return `Cinematic 9:16, ${frameType}, ${cameraMovement}, ${petRef}${visualDesc}, emotion: ${shot.emotion || 'melancholic'}, ${lighting} light with soft shadows, no people, smooth dissolve transition`
      }
    }

    // ── Hook Shot injection ───────────────────────────────────────────────
    // If hook exists from director-v2/hook-engine, use it as Shot 1.
    // Remaining shots follow the original ExecutionPlan.
    // If hook is missing or fails, fall back to original shot[0].
    let shotsForKling = selectedShots

    if (hookData && hookData.visual && hookData.text) {
      try {
        // Build a synthetic shot object from hook data, matching original shot structure
        const hookShot = {
          shotNumber: 1,
          type: 'face',
          shotType: 'face',
          duration: forcedDuration,
          scene: hookData.visual,
          text: hookData.text,
          emotion: selectedShots[0]?.emotion ?? 'tension',
          dialogue: hookData.audio,
          tension: 9,
          visualDescription: hookData.visual,
          description: hookData.visual,
          frameType: 'extreme close-up',
          cameraMovement: 'static with micro-tremor',
          lighting: 'high contrast, harsh',
          imageUrl: twin.frame_url_front,
        }
        // Prepend hook as Shot 1, keep remaining shots (skip original shot[0])
        shotsForKling = [hookShot, ...selectedShots.slice(1)]
        console.log('[movie/generate] hook injected as Shot 1:', hookData.text)
      } catch (hookInjectErr) {
        // Non-fatal: fall back to original shots
        console.warn('[movie/generate] hook injection failed (fallback to original shot[0]):', hookInjectErr)
        shotsForKling = selectedShots
      }
    } else {
      console.log('[movie/generate] no hook data — using original shot[0]')
    }
    // ── End Hook Shot injection ───────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multiShots = shotsForKling.map((shot: any, index: number) => ({
      prompt: buildPrompt(shot, index, shotsForKling.length),
      duration: forcedDuration, // ALWAYS use this, ignore shot.duration from Cognitive Core
    }))

    const totalPromptLength = multiShots.reduce((sum: number, s: { prompt: string; duration: number }) => sum + (s.prompt || '').length, 0)
    console.log('[movie/generate] total prompt length:', totalPromptLength)

    if (totalPromptLength > 2000) {
      const maxPerShot = Math.floor(2000 / multiShots.length)
      multiShots.forEach((s: { prompt: string; duration: number }) => {
        if (s.prompt && s.prompt.length > maxPerShot) {
          s.prompt = s.prompt.substring(0, maxPerShot)
        }
      })
      console.log('[movie/generate] prompts truncated to fit 2500 limit')
    }

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

    // Step 4: Generate videos with Happy Horse via fal.ai
    console.log('[movie/generate] generating videos with Happy Horse...')
    const videoUrls: string[] = []
    
    for (let i = 0; i < multiShots.length; i++) {
      const shot = multiShots[i]
      console.log(`[movie/generate] generating shot ${i + 1}/${multiShots.length}...`)
      
      try {
        const result = await fal.subscribe('alibaba/happy-horse/image-to-video', {
          input: {
            image_url: twin.frame_url_front ?? twin.frame_url_mid,
            prompt: shot.prompt,
            duration: shot.duration || 5,
          },
        })
        
        const videoUrl = result.data.video.url
        videoUrls.push(videoUrl)
        console.log(`[movie/generate] shot ${i + 1} generated:`, videoUrl)
      } catch (shotErr) {
        console.error(`[movie/generate] shot ${i + 1} failed:`, shotErr)
        throw new Error(`Shot ${i + 1} generation failed: ${shotErr}`)
      }
    }

    console.log('[movie/generate] all shots generated:', videoUrls.length)

    // Step 5: Update movie with video URLs and archetype
    await supabase
      .from('movies')
      .update({
        video_urls: videoUrls,
        status: 'completed',
        ...(archetype ? { archetype } : {})
      })
      .eq('id', movie.id)

    return NextResponse.json({
      success: true,
      movieId: movie.id,
      videoUrls,
      tier,
      message: 'Your movie has been created!'
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[movie/generate] ERROR:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
