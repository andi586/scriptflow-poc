import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json()
  const { characterId, projectId, imageType, publicUrl, storagePath, width, height, sortOrder } = body
  const { data, error } = await supabase
    .from('character_reference_assets')
    .insert({
      user_id: user.id,
      project_id: projectId,
      character_id: characterId,
      image_type: imageType,
      storage_path: storagePath,
      public_url: publicUrl,
      width,
      height,
      sort_order: sortOrder ?? 0,
      is_primary: imageType === 'front'
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const characterId = req.nextUrl.searchParams.get('characterId')
  if (!characterId) return NextResponse.json({ error: 'characterId required' }, { status: 400 })
  const { data, error } = await supabase
    .from('character_reference_assets')
    .select('*')
    .eq('character_id', characterId)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
