import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

// ── DEV MODE bypass ──────────────────────────────────────────────────────────
// Set to true to skip Stripe payment check and allow full generation pipeline.
// Set to false to restore normal payment-gated flow.
// REMOVE this flag and the bypass block before production release.
const DEV_MODE = true // TEMP: bypass payment for testing
// ── End DEV MODE ─────────────────────────────────────────────────────────────

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
      .insert({ user_id: crypto.randomUUID(), frame_url_front: photoUrl, is_active: true })
      .select().single()
    if (twinError) throw new Error('Twin failed: ' + twinError.message)

    console.log('[create-movie] twin:', twin.id, photoUrl)

    // Upload cast photos
    const castPhotoUrls: string[] = []
    for (let i = 0; i < 6; i++) {
      const castFile = form.get(`cast_${i}`) as File
      if (!castFile) break
      const castBytes = await castFile.arrayBuffer()
      const castBuffer = Buffer.from(castBytes)
      const castFileName = `twins/cast_${Date.now()}_${i}.jpg`
      const { error: castErr } = await supabase.storage.from('recordings').upload(castFileName, castBuffer, { contentType: 'image/jpeg', upsert: true })
      if (!castErr) {
        const { data: castPub } = supabase.storage.from('recordings').getPublicUrl(castFileName)
        castPhotoUrls.push(castPub.publicUrl)
      }
    }
    console.log('[create-movie] cast photos:', castPhotoUrls.length)

    // 4. Create movies record with status='pending', paid=false
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .insert({
        user_id: twin.user_id,
        status: 'pending',
        story_input: story,
        tier: 'standard',
        twin_photo_url: photoUrl,
        paid: false,
      })
      .select().single()
    if (movieError) throw new Error('Movie failed: ' + movieError.message)

    console.log('[create-movie] movie:', movie.id)

    // 5. DEV MODE: skip payment gate and trigger generation immediately
    if (DEV_MODE) {
      console.log('[create-movie] DEV_MODE=true — skipping Stripe, triggering generation directly')

      // Mark as paid so downstream checks pass
      await supabase.from('movies').update({ paid: true, status: 'processing' }).eq('id', movie.id)

      // Fire-and-forget: trigger movie generation pipeline
      const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
      fetch(`${baseUrl}/api/movie/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId: movie.id, userId: twin.id, story, additional_images: castPhotoUrls }),
      }).catch((err: Error) => console.error('[create-movie] DEV generation trigger failed:', err.message))

      return NextResponse.json({ movieId: movie.id, twinId: twin.id, photoUrl, dev: true })
    }

    // 5. Return { movieId, twinId, photoUrl }
    // Generation happens ONLY after Stripe payment webhook
    return NextResponse.json({ movieId: movie.id, twinId: twin.id, photoUrl })
  } catch (e: any) {
    console.error('[create-movie] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
