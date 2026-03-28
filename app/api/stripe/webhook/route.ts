import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, getRequiredEnv, type StripeSubscriptionStatus } from '@/lib/stripe/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ProfileUpsert = {
  id: string
  subscription_tier?: string | null
  subscription_status?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

async function upsertProfile(update: ProfileUpsert): Promise<void> {
  const { error } = await supabaseAdmin.from('profiles').upsert(update, { onConflict: 'id' })
  if (error) throw new Error(`Failed to upsert profile: ${error.message}`)
}

async function getUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<{ id: string }>()
  if (error) throw new Error(`Failed to find profile: ${error.message}`)
  return data?.id ?? null
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id ?? null
  const planKey = session.metadata?.plan_key ?? null
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null
  if (!userId || !customerId || !subscriptionId) throw new Error('Missing required fields in checkout.session.completed')
  await upsertProfile({ id: userId, subscription_tier: planKey, subscription_status: 'active', stripe_customer_id: customerId, stripe_subscription_id: subscriptionId })
}

async function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  const userId = subscription.metadata?.supabase_user_id ?? (await getUserIdByStripeCustomerId(customerId))
  if (!userId) throw new Error(`No matching user for deleted subscription customer ${customerId}`)
  await upsertProfile({ id: userId, subscription_status: 'canceled', stripe_customer_id: customerId, stripe_subscription_id: subscription.id })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
  if (!customerId) throw new Error('Missing customer id on invoice.payment_failed')
  let userId = await getUserIdByStripeCustomerId(customerId)
  const invoiceSubscription = (invoice as any).subscription
  if (!userId && invoiceSubscription) {
    const subscriptionId = typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription.id
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    userId = subscription.metadata?.supabase_user_id ?? (await getUserIdByStripeCustomerId(customerId))
  }
  if (!userId) throw new Error(`No matching user for failed invoice customer ${customerId}`)
  const subscriptionId = invoiceSubscription ? (typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription?.id ?? null) : null
  await upsertProfile({ id: userId, subscription_status: 'payment_failed', stripe_customer_id: customerId, stripe_subscription_id: subscriptionId })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = getRequiredEnv('STRIPE_WEBHOOK_SECRET')
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.deleted':
        await handleCustomerSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
