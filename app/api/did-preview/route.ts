import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 10 // 10 × 3s = 30s max

export async function POST(req: NextRequest) {
  const { imageUrl, text } = await req.json()

  const apiKey = process.env.DID_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DID_API_KEY not set' }, { status: 500 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase env not set' }, { status: 500 })
  }

  const auth = Buffer.from(`${apiKey}:`).toString('base64')

  // ── Step 1: Create D-ID talk ───────────────────────────────────────────────
  const createRes = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: imageUrl,
      script: {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: 'zh-CN-YunxiNeural'
        }
      }
    })
  })

  const createData = await createRes.json()
  const talkId = createData.id
  if (!talkId) {
    console.error('[did-preview] failed to create talk:', createData)
    return NextResponse.json({ error: 'D-ID talk creation failed', detail: createData }, { status: 500 })
  }
  console.log('[did-preview] talk created, talkId:', talkId)

  // ── Step 2: Poll until done (max 30s) ─────────────────────────────────────
  let resultUrl: string | null = null

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const pollRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    })
    const pollData = await pollRes.json()
    console.log(`[did-preview] poll #${attempt} status:`, pollData.status)

    if (pollData.status === 'done' && pollData.result_url) {
      resultUrl = pollData.result_url
      break
    }

    if (pollData.status === 'error') {
      return NextResponse.json({ error: 'D-ID generation error', detail: pollData }, { status: 500 })
    }
  }

  if (!resultUrl) {
    return NextResponse.json({ error: 'D-ID timed out after 30s' }, { status: 504 })
  }

  // ── Step 3: Download video from D-ID ──────────────────────────────────────
  const videoRes = await fetch(resultUrl)
  if (!videoRes.ok) {
    return NextResponse.json({ error: 'Failed to download D-ID video' }, { status: 500 })
  }
  const videoBuffer = await videoRes.arrayBuffer()

  // ── Step 4: Upload to Supabase Storage ────────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const filePath = `did-preview/${Date.now()}.mp4`

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('recordings')
    .upload(filePath, Buffer.from(videoBuffer), {
      contentType: 'video/mp4',
      upsert: true
    })

  if (uploadErr) {
    console.error('[did-preview] supabase upload error:', uploadErr)
    return NextResponse.json({ error: 'Supabase upload failed', detail: uploadErr.message }, { status: 500 })
  }

  const { data: pub } = supabase.storage.from('recordings').getPublicUrl(uploadData.path)
  console.log('[did-preview] uploaded to supabase:', pub.publicUrl)

  return NextResponse.json({ videoUrl: pub.publicUrl })
}
