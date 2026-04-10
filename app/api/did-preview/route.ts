import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { imageUrl, text } = await req.json()
  
  const apiKey = process.env.DID_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'DID_API_KEY not set' }, { status: 500 })

  const res = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_url: imageUrl,
      script: {
        type: 'text',
        input: text,
        provider: {
          type: 'microsoft',
          voice_id: 'zh-CN-XiaoxiaoNeural'
        }
      }
    })
  })

  const data = await res.json()
  return NextResponse.json({ talkId: data.id })
}
