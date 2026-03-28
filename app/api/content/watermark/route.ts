import { NextRequest, NextResponse } from 'next/server'
import { decodeContentWatermark, generateContentWatermark, type WatermarkSourceInput } from '@/lib/watermark/content-watermark'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Partial<{ creator_id: string; project_id: string; episode_id: string; generated_at?: string }>
    if (!isNonEmptyString(body.creator_id)) return NextResponse.json({ error: 'creator_id is required' }, { status: 400 })
    if (!isNonEmptyString(body.project_id)) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    if (!isNonEmptyString(body.episode_id)) return NextResponse.json({ error: 'episode_id is required' }, { status: 400 })
    const input: WatermarkSourceInput = { creator_id: body.creator_id, project_id: body.project_id, episode_id: body.episode_id, generated_at: body.generated_at }
    const watermark = generateContentWatermark(input)
    const decoded = decodeContentWatermark(watermark)
    return NextResponse.json({ success: true, watermark, data: decoded })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate watermark' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const watermark = request.nextUrl.searchParams.get('watermark')
    if (!isNonEmptyString(watermark)) return NextResponse.json({ error: 'watermark query param is required' }, { status: 400 })
    const decoded = decodeContentWatermark(watermark)
    return NextResponse.json({ success: true, valid: true, data: decoded })
  } catch (error) {
    return NextResponse.json({ success: false, valid: false, error: error instanceof Error ? error.message : 'Failed to verify watermark' }, { status: 400 })
  }
}
