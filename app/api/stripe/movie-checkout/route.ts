import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Log Stripe mode for debugging
    const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST'
    console.log('[stripe-checkout] Mode:', stripeMode)
    
    const { movieId, userId } = await request.json()
    
    // Try to get user from session, but allow userId from request body as fallback
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = user?.id || userId || 'anonymous'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getscriptflow.com'

    // Check if user has previous paid movies
    const { data: previousPaidMovies, error: queryError } = await supabase
      .from('movies')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('paid', true)
      .limit(1)

    if (queryError) {
      console.error('[movie-checkout] Error checking previous movies:', queryError)
    }

    // Determine pricing: $2.9 for first-time users, $4.9 for returning users
    const isFirstTime = !previousPaidMovies || previousPaidMovies.length === 0
    const price = isFirstTime ? 290 : 490 // in cents
    const priceLabel = isFirstTime ? 'First Movie Special' : 'Standard Price'

    console.log(`[movie-checkout] User ${effectiveUserId}: isFirstTime=${isFirstTime}, price=$${price/100}`)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `ScriptFlow Movie Generation${isFirstTime ? ' - First Movie Special' : ''}`,
            description: 'Generate your personalized AI movie'
          },
          unit_amount: price
        },
        quantity: 1
      }],
      success_url: `${baseUrl}/movie/${movieId}?paid=true`,
      cancel_url: `${baseUrl}/create`,
      client_reference_id: effectiveUserId,
      metadata: {
        supabase_user_id: effectiveUserId,
        movie_id: movieId,
        type: 'movie_generation',
        is_first_time: isFirstTime.toString(),
        price_tier: priceLabel
      }
    })

    return NextResponse.json({ 
      checkoutUrl: session.url,
      isFirstTime,
      price: price / 100
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
