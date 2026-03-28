import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, getRequiredEnv } from '@/lib/stripe/client'
import { getPlanPriceId, isSubscriptionTier, STRIPE_PLANS, type SubscriptionTier } from '@/lib/stripe/plans'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface CheckoutRequestBody { tier: SubscriptionTier }
interface ProfileRow {
  id: string
  stripe_customer_id: string | null
  subscription_tier: string | null
  subscription_status: string | null
  stripe_subscription_id: string | null
}

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  return request.nextUrl.origin.replace(/\/$/, '')
}

async function getOrCreateStripeCustomer(params: {
  userId: string; email: string; existingCustomerId: string | null
}): Promise<string> {
  const { userId, email, existingCustomerId } = params
  if (existingCustomerId) return existingCustomerId
  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  })
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, stripe_customer_id: customer.id }, { onConflict: 'id' })
  if (error) throw new Error(`Failed to persist stripe_customer_id: ${error.message}`)
  return customer.id
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as Partial<CheckoutRequestBody>
    const tier = body.tier
    if (!tier || !isSubscriptionTier(tier)) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier, subscription_status, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>()
    if (profileError) {
      return NextResponse.json({ error: `Failed to load profile: ${profileError.message}` }, { status: 500 })
    }

    const email = user.email
    if (!email) return NextResponse.json({ error: 'User email is required' }, { status: 400 })

    const customerId = await getOrCreateStripeCustomer({
      userId: user.id, email, existingCustomerId: profile?.stripe_customer_id ?? null,
    })

    const baseUrl = getBaseUrl(request)
    const priceId = getPlanPriceId(tier)
    const plan = STRIPE_PLANS[tier]

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/billing/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: user.id,
      customer_update: { address: 'auto', name: 'auto' },
      metadata: { supabase_user_id: user.id, plan_key: plan.key },
      subscription_data: { metadata: { supabase_user_id: user.id, plan_key: plan.key } },
    })

    return NextResponse.json({ checkoutUrl: session.url, sessionId: session.id })
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: `Stripe error: ${error.message}`, code: error.code ?? null }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
