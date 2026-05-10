import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { movieId, comment, reaction } = await req.json()
    
    // Save comment to market_feedback
    await supabase.from('market_feedback').insert({
      comments: { text: comment, reaction, movieId },
      conversion_rate: reaction === 'paid' ? 1 : 0
    })
    
    // If strong positive reaction, boost related emotion_lines
    if (['this hurt', 'why am I crying', 'this is me', 'I need this'].some(
      phrase => comment?.toLowerCase().includes(phrase.toLowerCase())
    )) {
      console.log('[MarketFeedback] Strong reaction detected - boosting emotion lines')
      
      // Get movie archetype
      const { data: movie } = await supabase
        .from('movies')
        .select('archetype')
        .eq('id', movieId)
        .single()
      
      if (movie?.archetype) {
        // Boost universality_score for related emotion lines
        await supabase.rpc('boost_emotion_lines', {
          archetype: movie.archetype,
          boost_amount: 1
        })
        
        console.log('[MarketFeedback] Boosted emotion lines for:', movie.archetype)
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[MarketFeedback] error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
