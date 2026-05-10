import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { movieId, watchTime, completed, shared } = await req.json()
    
    // Update market_feedback
    const { data: existing } = await supabase
      .from('market_feedback')
      .select('id')
      .eq('hook_experiment_id', movieId)
      .single()
    
    if (existing) {
      await supabase
        .from('market_feedback')
        .update({
          watch_time: watchTime,
          rewatch_rate: completed ? 1 : 0,
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('market_feedback')
        .insert({
          watch_time: watchTime,
          rewatch_rate: completed ? 1 : 0,
          comments: { shared },
        })
    }
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
