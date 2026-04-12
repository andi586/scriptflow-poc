import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { audioUrl } = await req.json()
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 })
  if (!audioUrl) return NextResponse.json({ error: 'no audioUrl' }, { status: 400 })

  try {
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error('Failed to download audio')
    const audioBuffer = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get('content-type') || 'audio/webm'
    const ext = contentType.includes('mp4') ? 'mp4' : 'webm'

    const form = new FormData()
    form.append('name', `clone-${Date.now()}`)
    form.append('files', new Blob([audioBuffer], { type: contentType }), `recording.${ext}`)
    form.append('remove_background_noise', 'true')

    const cloneRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    })

    if (!cloneRes.ok) {
      const err = await cloneRes.text()
      console.error('[voice-clone] ElevenLabs error:', err)
      return NextResponse.json({ error: 'clone failed' }, { status: 502 })
    }

    const data = await cloneRes.json()
    console.log('[voice-clone] success, voiceId:', data.voice_id)
    return NextResponse.json({ voiceId: data.voice_id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[voice-clone] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
