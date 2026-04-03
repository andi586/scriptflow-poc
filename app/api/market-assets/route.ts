import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Helper: get authenticated user from session cookie */
async function getUser() {
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  return { user, error }
}

/** Service-role Supabase client (bypasses RLS for writes) */
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * GET /api/market-assets
 * List all active market_assets (public, no auth required)
 */
export async function GET(_req: NextRequest) {
  try {
    const supabase = serviceClient()
    const { data, error } = await supabase
      .from('market_assets')
      .select('id, seller_id, project_id, type, title, description, price_cents, preview_url, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, assets: data ?? [] })
  } catch (err) {
    console.error('[market-assets GET]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/market-assets
 * Create a new market asset (requires auth)
 * Body: { type, title, description, price_cents, project_id?, preview_url?, asset_data? }
 */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, title, description, price_cents, project_id, preview_url, asset_data } = body

    // Validate required fields
    if (!type || !['character_pack', 'story_seed'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be character_pack or story_seed' },
        { status: 400 },
      )
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 })
    }
    const priceCents = Number(price_cents ?? 999)
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ success: false, error: 'invalid price_cents' }, { status: 400 })
    }

    const supabase = serviceClient()
    const { data, error } = await supabase
      .from('market_assets')
      .insert({
        seller_id: user.id,
        project_id: project_id ?? null,
        type,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() : null,
        price_cents: priceCents,
        status: 'active',
        asset_data: asset_data ?? {},
        preview_url: typeof preview_url === 'string' && preview_url.trim() ? preview_url.trim() : null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, asset: data }, { status: 201 })
  } catch (err) {
    console.error('[market-assets POST]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
