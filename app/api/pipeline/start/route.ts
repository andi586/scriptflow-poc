import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Start the generation pipeline for a project.
 *
 * POST /api/pipeline/start
 * Body: { script, imageUrl?, audioUrl?, voiceId?, isStarMode? }
 *
 * Steps:
 * 1. Create a project row in Supabase (status='draft')
 * 2. Store script in story_memory
 * 3. Set status='active' to signal pipeline is running
 * 4. Return projectId
 *
 * The actual generation (OmniHuman / NEL) is handled by the caller
 * after receiving the projectId.
 */
export async function POST(request: NextRequest) {
  console.log('[pipeline/start] ENTER', new Date().toISOString())

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[pipeline/start] Supabase env vars missing')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await request.json()
    const {
      script,
      imageUrl,
      audioUrl,
      voiceId,
      isStarMode = false,
      userId,
    } = body as {
      script?: string
      imageUrl?: string
      audioUrl?: string
      voiceId?: string
      isStarMode?: boolean
      userId?: string
    }

    // Detect language from script text: Chinese characters → 'zh', otherwise 'en'
    const detectedLanguage = /[\u4e00-\u9fff]/.test(script ?? '') ? 'zh' : 'en'
    console.log('[pipeline/start] detectedLanguage:', detectedLanguage)

    console.log('[pipeline/start] params:', {
      hasScript: !!script,
      hasImageUrl: !!imageUrl,
      hasAudioUrl: !!audioUrl,
      hasVoiceId: !!voiceId,
      isStarMode,
      userId,
    })

    if (!script?.trim()) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    // ── Step 1: Create project row ────────────────────────────────────────────
    // user_id is required by schema — use provided userId or a placeholder
    const effectiveUserId = userId ?? '00000000-0000-0000-0000-000000000000'

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: effectiveUserId,
        status: 'draft',
        is_star_mode: isStarMode,
        language: detectedLanguage,
        title: (script as any)?.title ?? `Movie ${new Date().toISOString().slice(0, 10)}`,
      })
      .select('id')
      .single()

    if (projectError || !project) {
      console.error('[pipeline/start] project insert error:', projectError?.message)
      // Non-fatal: return a fake projectId so the pipeline can continue
      const fakeId = `local_${Date.now()}`
      console.warn('[pipeline/start] DB unavailable, using fakeId:', fakeId)
      return NextResponse.json({
        success: true,
        projectId: fakeId,
        status: 'active',
        warning: projectError?.message ?? 'DB insert failed, using local ID',
      })
    }

    const projectId = project.id
    console.log('[pipeline] starting for project:', projectId)

    // ── Step 2: Store script in story_memory ──────────────────────────────────
    const { error: memError } = await supabase
      .from('story_memory')
      .insert({ project_id: projectId, synopsis: script.trim() })

    if (memError) {
      console.warn('[pipeline/start] story_memory insert error (non-fatal):', memError.message)
    }

    // ── Step 3: Store optional media URLs ─────────────────────────────────────
    const updates: Record<string, unknown> = { status: 'active' }
    if (imageUrl) updates.keyframe_url = imageUrl
    if (voiceId)  updates.user_voice_id = voiceId

    const { error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)

    if (updateError) {
      console.warn('[pipeline/start] project update error (non-fatal):', updateError.message)
    }

    console.log('[pipeline/start] project created and activated:', projectId)

    return NextResponse.json({
      success: true,
      projectId,
      status: 'active',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pipeline/start] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
