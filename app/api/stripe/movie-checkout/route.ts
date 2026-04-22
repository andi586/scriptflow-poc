import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { movieId, userId } = await request.json()
    
    // Try to get user from session, but allow userId from request body as fallback
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = user?.id || userId || 'anonymous'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getscriptflow.com'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'ScriptFlow Movie Generation',
            description: 'Generate your personalized AI movie'
          },
          unit_amount: 290
        },
        quantity: 1
      }],
      success_url: `${baseUrl}/movie/${movieId}?paid=true`,
      cancel_url: `${baseUrl}/create`,
      client_reference_id: effectiveUserId,
      metadata: {
        supabase_user_id: effectiveUserId,
        movie_id: movieId,
        type: 'movie_generation'
      }
    })

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
