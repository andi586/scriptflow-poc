import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('projects')
      .select('final_video_url')
      .not('final_video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data?.final_video_url) {
      return NextResponse.json({ url: data.final_video_url })
    }
    return NextResponse.json({ url: null })
  } catch {
    return NextResponse.json({ url: null })
  }
}
