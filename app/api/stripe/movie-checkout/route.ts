import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/app/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { movieId } = await request.json()
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
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
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
