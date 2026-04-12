import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Check if an email is in the WHITELIST_EMAILS env var (comma-separated) */
function isWhitelisted(email: string | null | undefined): boolean {
  if (!email) return false
  const whitelist = (process.env.WHITELIST_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return whitelist.includes(email.toLowerCase())
}

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
      userEmail: bodyUserEmail,
    } = body as {
      script?: string
      imageUrl?: string
      audioUrl?: string
      voiceId?: string
      isStarMode?: boolean
      userId?: string
      userEmail?: string | null
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

    // ── Whitelist check ───────────────────────────────────────────────────────
    // Prefer email from request body; fall back to Supabase auth token
    let userEmail: string | null = bodyUserEmail ?? null
    if (!userEmail) {
      try {
        const authHeader = request.headers.get('authorization') ?? ''
        const token = authHeader.replace('Bearer ', '').trim()
        if (token) {
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          const authClient = createClient(supabaseUrl!, anonKey)
          const { data: { user } } = await authClient.auth.getUser(token)
          userEmail = user?.email ?? null
        }
      } catch (authErr) {
        console.warn('[pipeline/start] auth check failed (non-fatal):', authErr instanceof Error ? authErr.message : authErr)
      }
    }

    const whitelisted = isWhitelisted(userEmail)
    console.log('[pipeline/start] userEmail:', userEmail, 'whitelisted:', whitelisted)

    // ── Step 1: Create project row ────────────────────────────────────────────
    // Only include user_id if we have a valid one — omitting it avoids FK constraint errors
    const insertData: Record<string, unknown> = {
      status: 'draft',
      is_star_mode: isStarMode,
      language: detectedLanguage,
      title: (script as any)?.title ?? `Movie ${new Date().toISOString().slice(0, 10)}`,
    }
    if (userId) {
      insertData.user_id = userId
    }
    console.log('[pipeline/start] inserting project, has user_id:', !!userId)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(insertData)
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
      isPreview: !whitelisted,
      whitelisted,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[pipeline/start] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
