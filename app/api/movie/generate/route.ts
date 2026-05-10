import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { matchDirectorIntent, applyDirectorIntent } from '@/app/lib/templates'
import { getTemplateBlueprint } from '@/app/lib/template-blueprints'
import { getFormatRules, FormatType } from '../../../../../lib/format-adapter'

export const maxDuration = 300

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[DEBUG] Request body keys:', Object.keys(body))
    console.log('[DEBUG] additional_images raw:', body.additional_images)
    console.log('[DEBUG] story_category:', body.story_category)
    
    const { story, tier = '60s', userId, additional_images, story_category, main_photo_url, format } = body

    if (!story) {
      return NextResponse.json({ error: 'Story is required' }, { status: 400 })
    }

    // Get format rules
    const formatType = (format || 'hook_15s') as FormatType
    const formatRules = getFormatRules(formatType)
    
    console.log('[movie/generate] story:', story, 'tier:', tier)
    console.log('[movie/generate] format:', formatType, 'duration:', formatRules.duration, 'maxShots:', formatRules.maxShots)
    console.log('[movie/generate] main_photo_url received:', main_photo_url)

    // ── Daily cost guard ──────────────────────────────────────────────────────
    const ADMIN_USER_ID = 'e01310e2-41dc-46b5-818e-a6104f48796a'
    
    // Check if user is paid (has any paid movies)
    const { data: paidMovies } = await supabase
      .from('movies')
      .select('id')
      .eq('user_id', userId)
      .eq('paid', true)
      .limit(1)
    
    const isPaid = paidMovies && paidMovies.length > 0
    
    // Get today's movie count for this user
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: dailyCount } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
    
    // Apply limits based on user type
    let dailyLimit: number
    let limitMessage: string = 'Daily limit reached. Please try again tomorrow.'
    
    if (userId === ADMIN_USER_ID) {
      // Admin: unlimited
      dailyLimit = Infinity
      console.log('[cost-guard] admin user - no limit')
    } else if (isPaid) {
      // Paid users: 20 per day
      dailyLimit = 20
      limitMessage = 'Daily limit reached (20 movies/day for paid users). Please try again tomorrow.'
      console.log('[cost-guard] paid user - daily count:', dailyCount, '/ limit:', dailyLimit)
    } else {
      // Free users: 3 per day
      dailyLimit = 3
      limitMessage = 'Daily limit reached (3 movies/day for free users). Upgrade to create more!'
      console.log('[cost-guard] free user - daily count:', dailyCount, '/ limit:', dailyLimit)
    }
    
    if ((dailyCount ?? 0) >= dailyLimit) {
      return NextResponse.json({ error: limitMessage }, { status: 429 })
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
    let { data: twin } = await supabase
      .from('digital_twins')
      .select('id, frame_url_mid, frame_url_front')
      .eq('id', userId)
      .single()

    if (!twin) {
      // Guest user without digital twin - use main_photo_url
      console.log('[movie/generate] No twin found, using main_photo_url for guest user')
      
      if (!main_photo_url) {
        return NextResponse.json({ error: 'Please upload your photo' }, { status: 400 })
      }
      
      // Create temporary twin object for guest user
      twin = { 
        id: userId,
        frame_url_front: main_photo_url,
        frame_url_mid: main_photo_url
      }
      console.log('[movie/generate] Using main_photo_url as main character:', main_photo_url)
    } else {
      console.log('[movie/generate] twin found:', twin.id)
      console.log('[movie/generate] twin photo:', twin?.frame_url_front)
    }
    
    console.log('[movie/generate] additional_images received:', additional_images?.length || 0, additional_images)

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 2: Check for Emotion Blueprint OR DirectorIntent template match
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Template ID to Emotion Blueprint mapping
    const EMOTION_BLUEPRINT_TEMPLATES = [
      'what_could_have_been',
      'phone_3am',
      'she_didnt_choose_you',
      'future_warning',
      'future_you',
      'group_chat',
      'last_person',
      'dog_last_words',
      'lost_someone',
      'friend_betrayal',
      'parallel_universe',
      'breaking_news'
    ]
    
    let shots: any[] = []
    let archetype: string | null = null
    let hookData: any = null
    
    // Check if story_category matches an emotion blueprint template
    const emotionBlueprint = story_category ? getTemplateBlueprint(story_category) : null
    
    if (emotionBlueprint) {
      // ✅ Emotion Blueprint matched - use it directly, skip DirectorIntent
      console.log(`[movie/generate] 🎨 Emotion Blueprint matched: "${emotionBlueprint.title}"`)
      console.log(`[movie/generate] Using emotion blueprint directly, skipping DirectorIntent`)
      
      // Convert emotion blueprint shots to the format expected by movie generation
      shots = emotionBlueprint.shots.map((blueprintShot, index) => ({
        shotNumber: blueprintShot.shot_number,
        duration: parseInt(blueprintShot.duration.replace('s', '')),
        shotType: blueprintShot.must_have.some(req => req.includes('@image')) ? 'face' : 'scene',
        type: blueprintShot.must_have.some(req => req.includes('@image')) ? 'close-up' : 'wide',
        emotion: blueprintShot.emotion_beat,
        description: blueprintShot.must_have.join(', '),
        visualDescription: blueprintShot.must_have.join(', '),
        cameraMovement: 'cinematic',
        lighting: blueprintShot.visual_style,
        dialogue: index === emotionBlueprint.shots.length - 1 ? emotionBlueprint.ending.killer_line : undefined
      }))
      
      archetype = story_category // Use template ID as archetype
      console.log('[DEBUG] archetype SET (emotion blueprint):', archetype)
      hookData = null // Emotion blueprints have built-in hooks
      
      console.log('[movie/generate] Emotion Blueprint shots:', shots.length, 'archetype:', archetype)
    } else {
      // Check for DirectorIntent match (skip if breaking_news/prank without blueprint)
      const skipDirectorIntent = story_category === 'breaking_news' || story_category === 'prank'
      const directorIntent = skipDirectorIntent ? null : matchDirectorIntent(story)
      
      if (directorIntent) {
        // ✅ DirectorIntent template matched - use fixed shot structure
        console.log(`[movie/generate] 🎬 DirectorIntent matched: "${directorIntent.intent}"`)
        console.log(`[movie/generate] Using template shots instead of CognitiveCore`)
        
        // Apply template with character details (CognitiveCore only fills in character info)
        const templateShots = applyDirectorIntent(directorIntent, {
          mainCharacter: 'character',
          location: 'scene'
        })
        
        shots = templateShots
        archetype = directorIntent.archetype
        console.log('[DEBUG] archetype SET (DirectorIntent):', archetype)
        hookData = null // DirectorIntent templates have built-in hooks in shot 1
        
        console.log('[movie/generate] DirectorIntent shots:', shots.length, 'archetype:', archetype)
      } else {
        // ❌ No template match - fall back to CognitiveCore
        console.log('[movie/generate] No DirectorIntent match, using CognitiveCore')
        
        // Add prank template context if breaking_news category
        let enhancedStory = story
        if (story_category === 'prank' || story_category === 'breaking_news') {
          enhancedStory = `${story}\n\nThis is a prank video. @image_1 is the friend being pranked (main character). @image_2 is the user who set up the prank. Both must appear in the video. @image_1 appears shocked/confused. @image_2 appears amused/laughing.`
          console.log('[movie/generate] 🎭 Prank template detected - adding two-character context')
        }
        
        const scriptRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: enhancedStory, personalNote: enhancedStory })
        })
        const scriptData = await scriptRes.json()
        console.log('[DEBUG scriptData]', scriptData)
        console.log('[DEBUG shots]', scriptData?.shots)
        console.log('[DEBUG directionPlan]', scriptData?.directionPlan)
        console.log('[DEBUG hook]', scriptData?.hook)

        shots = scriptData?.directionPlan?.shots ?? []
        archetype = scriptData?.directionPlan?.archetype ?? scriptData?.archetype ?? null
        console.log('[DEBUG] archetype SET (CognitiveCore):', archetype)
        hookData = scriptData?.hook ?? null

        console.log('[movie/generate] Cognitive Core shots:', shots.length, 'archetype:', archetype, 'hook:', !!hookData)
      }
    }

    // Use format rules to determine shot count and duration
    const maxShots = formatRules.maxShots || 4
    const shotDurationSeconds = formatRules.duration / maxShots
    const selectedShots = shots.slice(0, maxShots)

    // Use format-based duration per shot
    const forcedDuration = Math.floor(shotDurationSeconds)
    
    console.log('[movie/generate] Using format rules - maxShots:', maxShots, 'duration per shot:', forcedDuration)

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
        let dialogue = shot.dialogue || ''
        const frameType = shot.frameType || shot.type || 'close-up'
        const cameraMovement = shot.cameraMovement || movement
        const lighting = shot.lighting || 'soft cinematic'
        let visualDesc = shot.visualDescription || shot.description || ''

        // Fix character numbering: replace "1号"/"2号" with @image_N
        dialogue = dialogue.replace(/1号/g, '@image_1').replace(/2号/g, '@image_2').replace(/3号/g, '@image_3')
        visualDesc = visualDesc.replace(/1号/g, '@image_1').replace(/2号/g, '@image_2').replace(/3号/g, '@image_3')

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
        let rawDesc = shot.scenePrompt || shot.visualDescription || shot.description || environment
        
        // Fix character numbering: replace "1号"/"2号" with @image_N
        rawDesc = rawDesc.replace(/1号/g, '@image_1').replace(/2号/g, '@image_2').replace(/3号/g, '@image_3')
        
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
      duration: shot.duration || forcedDuration, // Use template duration if available, otherwise use tier default
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

    // Ensure total duration doesn't exceed 15 seconds for Kling
    const MAX_KLING_DURATION = 15
    let totalDuration = multiShots.reduce((sum: number, s: any) => sum + s.duration, 0)

    if (totalDuration > MAX_KLING_DURATION) {
      // Scale down all durations proportionally
      const scale = MAX_KLING_DURATION / totalDuration
      multiShots.forEach((s: any) => {
        s.duration = Math.max(2, Math.floor(s.duration * scale))
      })
      console.log('[movie/generate] scaled durations to fit 15s limit:', multiShots.map((s: any) => s.duration))
    }

    // Step 3: Create movie record with shots data
    console.log('[DEBUG] FINAL archetype before DB:', { story_category, archetype, final: story_category || archetype })
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .insert({
        user_id: userId,
        status: 'pending',
        tier,
        story_input: JSON.stringify({ shots: shotsForKling }),
        twin_photo_url: twin.frame_url_mid,
        archetype: story_category || archetype
      })
      .select()
      .single()

    if (movieError) throw new Error('Failed to create movie: ' + movieError.message)

    console.log('[movie/generate] movie created:', movie.id, 'with', shotsForKling.length, 'shots')

    // Step 4: Call Kling 3.0 Omni - ONE API call with native audio
    // Prepare images array with 7-image limit for Kling API
    const allImages = additional_images && additional_images.length > 0
      ? [twin.frame_url_front ?? twin.frame_url_mid, ...additional_images]
      : [twin.frame_url_front ?? twin.frame_url_mid]
    
    // Kling API supports maximum 7 images
    const klingImages = allImages.filter(Boolean).slice(0, 7)
    console.log('[movie/generate] sending', klingImages.length, 'images to Kling API:', klingImages)
    
    const klingBody = {
      model: 'kling',
      task_type: 'omni_video_generation',
      input: {
        version: '3.0',
        resolution: '720p',
        aspect_ratio: '9:16',
        enable_audio: true,
        language: 'en',  // Force English TTS for all dialogue
        images: klingImages,
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
    
    console.log('[movie/generate] Kling API language set to: en (English)')

    // Kling API call with auto-retry
    let klingData: any = null
    let taskId: string | null = null
    let retryCount = 0
    const MAX_RETRIES = 1

    while (retryCount <= MAX_RETRIES && !taskId) {
      try {
        if (retryCount > 0) {
          console.log(`[movie/generate] Retry attempt ${retryCount}/${MAX_RETRIES} after 30s...`)
          await new Promise(resolve => setTimeout(resolve, 30000)) // Wait 30 seconds
        }

        const klingRes = await fetch('https://api.piapi.ai/api/v1/task', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.PIAPI_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(klingBody)
        })

        klingData = await klingRes.json()
        taskId = klingData?.data?.task_id

        console.log(`[movie/generate] Kling attempt ${retryCount + 1} - task_id:`, taskId)

        if (!taskId) {
          console.warn(`[movie/generate] Kling attempt ${retryCount + 1} failed:`, JSON.stringify(klingData).slice(0, 200))
          retryCount++
        }
      } catch (klingErr) {
        console.error(`[movie/generate] Kling attempt ${retryCount + 1} error:`, klingErr)
        retryCount++
      }
    }

    if (!taskId) {
      // All retries failed - mark movie as failed and notify user
      await supabase
        .from('movies')
        .update({ status: 'failed' })
        .eq('id', movie.id)
      
      console.error('[movie/generate] Kling task creation failed after retries:', JSON.stringify(klingData).slice(0, 200))
      throw new Error('Kling task creation failed after retries. Please try again later.')
    }

    // Step 5: Update movie with task_id
    await supabase
      .from('movies')
      .update({
        kling_task_id: taskId,
        status: 'processing'
      })
      .eq('id', movie.id)

    // Trigger hook generation (fire and forget) BEFORE returning response
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/hook/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: movie.id })
    }).catch(err => console.error('[movie/generate] hook trigger failed:', err))

    console.log('[movie/generate] hook generation triggered for:', movie.id)

    // Then return response
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
