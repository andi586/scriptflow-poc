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
    return NextResponse.json({ success: false, error: 'preview_failed' }, { status: 500 })
  }

  if (!apiKey) {
    console.warn('[did-preview] DID_API_KEY not set')
    return NextResponse.json({ success: false, error: 'preview_failed' })
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64')

    // ── Step 1: Create D-ID talk ─────────────────────────────────────────────
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
      console.error('[did-preview] D-ID talk creation failed:', JSON.stringify(createData))
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }

    console.log('[did-preview] talk created, talkId:', talkId)

    // ── Step 2: Poll until done (max 30s) ────────────────────────────────────
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
        console.error('[did-preview] D-ID generation error:', JSON.stringify(pollData))
        return NextResponse.json({ success: false, error: 'preview_failed' })
      }
    }

    if (!resultUrl) {
      console.error('[did-preview] D-ID timed out after 30s')
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }

    // ── Step 3: Download video from D-ID ─────────────────────────────────────
    const videoRes = await fetch(resultUrl)
    if (!videoRes.ok) {
      console.error('[did-preview] Failed to download D-ID video:', videoRes.status)
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }
    const videoBuffer = await videoRes.arrayBuffer()

    // ── Step 4: Upload to Supabase Storage ───────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const filePath = `did-preview/${Date.now()}.mp4`

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('recordings')
      .upload(filePath, Buffer.from(videoBuffer), {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[did-preview] Supabase upload error:', uploadErr.message)
      return NextResponse.json({ success: false, error: 'preview_failed' })
    }

    const { data: pub } = supabase.storage.from('recordings').getPublicUrl(uploadData.path)
    console.log('[did-preview] uploaded to supabase:', pub.publicUrl)

    return NextResponse.json({ success: true, videoUrl: pub.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[did-preview] unexpected error:', msg)
    return NextResponse.json({ success: false, error: 'preview_failed' })
  }
}
