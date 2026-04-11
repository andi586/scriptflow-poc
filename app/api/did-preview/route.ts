import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 10 // 10 × 3s = 30s max

export async function POST(req: NextRequest) {
  const { imageUrl, text, voiceId } = await req.json()

  const apiKey = process.env.DID_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env not set' }, { status: 500 })
  }

  // ── Try D-ID first ─────────────────────────────────────────────────────────
  if (apiKey) {
    try {
      const auth = Buffer.from(`${apiKey}:`).toString('base64')

      // Step 1: Create D-ID talk
      const createRes = await fetch('https://api.d-id.com/talks', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: imageUrl,
          script: {
            type: 'text',
            input: text,
            provider: voiceId
              ? {
                  type: 'elevenlabs',
                  voice_id: voiceId,
                  model_id: 'eleven_multilingual_v2',
                }
              : {
                  type: 'microsoft',
                  voice_id: 'zh-CN-YunxiNeural',
                },
          },
        }),
      })

      const createData = await createRes.json()
      const talkId = createData.id

      if (!talkId) {
        console.warn('[did-preview] D-ID talk creation failed, falling back:', JSON.stringify(createData))
        throw new Error('D-ID talk creation failed: no talkId')
      }

      console.log('[did-preview] talk created, talkId:', talkId)

      // Step 2: Poll until done (max 30s)
      let resultUrl: string | null = null

      for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

        const pollRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
          headers: { Authorization: `Basic ${auth}` },
        })
        const pollData = await pollRes.json()
        console.log(`[did-preview] poll #${attempt} status:`, pollData.status)

        if (pollData.status === 'done' && pollData.result_url) {
          resultUrl = pollData.result_url
          break
        }

        if (pollData.status === 'error') {
          throw new Error(`D-ID generation error: ${JSON.stringify(pollData)}`)
        }
      }

      if (!resultUrl) {
        throw new Error('D-ID timed out after 30s')
      }

      // Step 3: Download video from D-ID
      const videoRes = await fetch(resultUrl)
      if (!videoRes.ok) throw new Error(`Failed to download D-ID video: ${videoRes.status}`)
      const videoBuffer = await videoRes.arrayBuffer()

      // Step 4: Upload to Supabase Storage
      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const filePath = `did-preview/${Date.now()}.mp4`

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('recordings')
        .upload(filePath, Buffer.from(videoBuffer), {
          contentType: 'video/mp4',
          upsert: true,
        })

      if (uploadErr) throw new Error(`Supabase upload failed: ${uploadErr.message}`)

      const { data: pub } = supabase.storage.from('recordings').getPublicUrl(uploadData.path)
      console.log('[did-preview] uploaded to supabase:', pub.publicUrl)

      return NextResponse.json({ videoUrl: pub.publicUrl })
    } catch (didErr) {
      const msg = didErr instanceof Error ? didErr.message : String(didErr)
      console.warn('[did-preview] D-ID failed, falling back to local-preview:', msg)
      // Fall through to local-preview fallback below
    }
  } else {
    console.warn('[did-preview] DID_API_KEY not set, using local-preview fallback')
  }

  // ── Fallback: call /api/local-preview ─────────────────────────────────────
  try {
    const baseUrl = req.nextUrl.origin
    const fallbackRes = await fetch(`${baseUrl}/api/local-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, text }),
    })

    const fallbackData = await fallbackRes.json()

    if (!fallbackRes.ok || !fallbackData.videoUrl) {
      console.error('[did-preview] local-preview fallback also failed:', fallbackData)
      return NextResponse.json(
        { error: 'Both D-ID and local-preview failed', detail: fallbackData },
        { status: 502 }
      )
    }

    console.log('[did-preview] local-preview fallback succeeded:', fallbackData.videoUrl)
    return NextResponse.json({ videoUrl: fallbackData.videoUrl, fallback: true })
  } catch (fallbackErr) {
    const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
    console.error('[did-preview] local-preview fallback threw:', msg)
    return NextResponse.json({ error: `All preview methods failed: ${msg}` }, { status: 502 })
  }
}
