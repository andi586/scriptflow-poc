import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { movieId } = await request.json()
    const supabase = createClient()
    
    const { data: movie } = await supabase
      .from('movies')
      .select('*')
      .eq('id', movieId)
      .single()
    
    if (!movie) return NextResponse.json({ error: 'Movie not found' }, { status: 404 })
    
    // TODO: generate hook video
    // For now return placeholder
    return NextResponse.json({ 
      hookVideoUrl: null,
      message: 'Hook system coming soon'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
