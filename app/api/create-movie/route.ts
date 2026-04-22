import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple in-memory rate limit (resets on redeploy)
const ipLimits = new Map<string, number>()

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 1 movie per IP per day
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const today = new Date().toDateString()
    const key = `${ip}_${today}`
    const count = ipLimits.get(key) || 0
    if (count >= 10) {
      return NextResponse.json({ 
        error: 'Daily limit reached. Contact us to generate more movies.' 
      }, { status: 429 })
    }
    ipLimits.set(key, count + 1)

    const form = await req.formData()
    const photo = form.get('photo') as File
    const story = form.get('story') as string
    const tier = form.get('tier') as string || '60s'

    if (!photo) return NextResponse.json({ error: 'No photo' }, { status: 400 })
    if (!story) return NextResponse.json({ error: 'No story' }, { status: 400 })

    const castPhotos = []
    let i = 0
    while (form.get(`cast_${i}`)) {
      castPhotos.push(form.get(`cast_${i}`) as File)
      i++
    }

    const totalPhotos = 1 + castPhotos.length // 1 for main photo
    if (totalPhotos > 7) {
      return NextResponse.json({ error: 'Maximum 7 photos allowed' }, { status: 400 })
    }

    // 1. Upload photo
    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `twins/${Date.now()}_photo.jpg`
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true })
    if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

    // 2. Get public URL
    const { data: pub } = supabase.storage.from('recordings').getPublicUrl(fileName)
    const photoUrl = pub.publicUrl

    // 3. Create digital twin
    const { data: twin, error: twinError } = await supabase
      .from('digital_twins')
      .insert({ user_id: crypto.randomUUID(), frame_url_mid: photoUrl, is_active: true })
      .select().single()
    if (twinError) throw new Error('Twin failed: ' + twinError.message)

    console.log('[create-movie] twin:', twin.id, photoUrl)

    // 4. Upload cast photos and collect their URLs
    const additionalImages: string[] = []
    for (let j = 0; j < castPhotos.length; j++) {
      const castFile = castPhotos[j]
      const castBytes = await castFile.arrayBuffer()
      const castBuffer = Buffer.from(castBytes)
      const castFileName = `twins/${Date.now()}_cast_${j}.jpg`
      const { error: castUploadError } = await supabase.storage
        .from('recordings')
        .upload(castFileName, castBuffer, { contentType: 'image/jpeg', upsert: true })
      if (castUploadError) {
        console.warn('[create-movie] cast photo upload failed:', castUploadError.message)
        continue
      }
      const { data: castPub } = supabase.storage.from('recordings').getPublicUrl(castFileName)
      additionalImages.push(castPub.publicUrl)
      console.log('[create-movie] cast photo uploaded:', castPub.publicUrl)
    }

    // 5. Call generate-script first to get story_category
    let storyCategoryFromScript: string | undefined
    try {
      const scriptRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: story, personalNote: story })
      })
      const scriptData = await scriptRes.json()
      storyCategoryFromScript = scriptData?.story_category
      console.log('[create-movie] story_category:', storyCategoryFromScript)
    } catch (e) {
      console.warn('[create-movie] generate-script pre-call failed, story_category unknown:', e)
    }

    // 6. Movie generation triggered AFTER Stripe payment
    // DO NOT generate here - wait for Stripe webhook
    if (false) { // disabled - payment required first
    const genRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/movie/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story, tier, userId: twin.id, additional_images: additionalImages, story_category: storyCategoryFromScript })
    })
    const genData = await genRes.json()
    if (!genRes.ok) throw new Error(genData.error || 'Generation failed')

    return NextResponse.json({ movieId: genData.movieId })
  } catch (e: any) {
    console.error('[create-movie] error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
