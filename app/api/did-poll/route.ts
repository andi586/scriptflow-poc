import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const talkId = req.nextUrl.searchParams.get('talkId')
  if (!talkId) return NextResponse.json({ error: 'missing talkId' }, { status: 400 })

  const apiKey = process.env.DID_API_KEY
  const auth = Buffer.from(`${apiKey}:`).toString('base64')

  const res = await fetch(`https://api.d-id.com/talks/${talkId}`, {
    headers: {
      'Authorization': `Basic ${auth}`
    }
  })

  const data = await res.json()
  console.log('[did-poll] status:', data.status, 'result_url:', data.result_url)
  return NextResponse.json(data)
}
