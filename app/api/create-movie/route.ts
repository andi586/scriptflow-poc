import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Validate inputs
    const form = await req.formData()
    const photo = form.get('photo') as File
    const story = form.get('story') as string

    if (!photo) return NextResponse.json({ error: 'No photo' }, { status: 400 })
    if (!story) return NextResponse.json({ error: 'No story' }, { status: 400 })

    // 2. Upload photo to Supabase Storage
    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `twins/${Date.now()}_photo.jpg`
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true })
    if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

    const { data: pub } = supabase.storage.from('recordings').getPublicUrl(fileName)
    const photoUrl = pub.publicUrl

    // 3. Create digital twin record
    const { data: twin, error: twinError } = await supabase
      .from('digital_twins')
      .insert({ user_id: crypto.randomUUID(), frame_url_mid: photoUrl, is_active: true })
      .select().single()
    if (twinError) throw new Error('Twin failed: ' + twinError.message)

    console.log('[create-movie] twin:', twin.id, photoUrl)

    // 4. Create movies record with status='pending', paid=false
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .insert({ twin_id: twin.id, story, status: 'pending', paid: false })
      .select().single()
    if (movieError) throw new Error('Movie failed: ' + movieError.message)

    console.log('[create-movie] movie:', movie.id)

    // 5. Return { movieId, twinId, photoUrl }
    // Generation happens ONLY after Stripe payment webhook
    return NextResponse.json({ movieId: movie.id, twinId: twin.id, photoUrl })
  } catch (e: any) {
    console.error('[create-movie] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
