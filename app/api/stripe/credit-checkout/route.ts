import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

// Credit packages configuration
const CREDIT_PACKAGES = {
  pack_3: { credits: 3, price: 1290, name: '3 Movies Pack' },
  pack_5: { credits: 5, price: 1990, name: '5 Movies Pack (Most Popular)' },
  pack_10: { credits: 10, price: 3490, name: '10 Movies Pack' }
}

export async function POST(request: NextRequest) {
  try {
    // Log Stripe mode for debugging
    const stripeMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST'
    console.log('[credit-checkout] Mode:', stripeMode)
    
    const { packageId, userId } = await request.json()
    
    // Validate package
    if (!packageId || !CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]) {
      return NextResponse.json({ error: 'Invalid package ID' }, { status: 400 })
    }
    
    const package_ = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES]
    
    // Try to get user from session, but allow userId from request body as fallback
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const effectiveUserId = user?.id || userId || 'anonymous'
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://getscriptflow.com'

    console.log(`[credit-checkout] User ${effectiveUserId}: package=${packageId}, credits=${package_.credits}, price=$${package_.price/100}`)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: package_.name,
            description: `${package_.credits} movie credits for ScriptFlow`
          },
          unit_amount: package_.price
        },
        quantity: 1
      }],
      success_url: `${baseUrl}/credits?success=true`,
      cancel_url: `${baseUrl}/credits`,
      client_reference_id: effectiveUserId,
      metadata: {
        supabase_user_id: effectiveUserId,
        type: 'credit_purchase',
        package_id: packageId,
        credits: package_.credits.toString()
      }
    })

    return NextResponse.json({ 
      checkoutUrl: session.url,
      packageId,
      credits: package_.credits,
      price: package_.price / 100
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[credit-checkout] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
