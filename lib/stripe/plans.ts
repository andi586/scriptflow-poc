export type SubscriptionTier = 'basic' | 'professional' | 'studio'

export interface StripePlanDefinition {
  key: SubscriptionTier
  name: string
  monthlyPriceUsd: number
  priceEnvKey: string
}

export const STRIPE_PLANS: Record<SubscriptionTier, StripePlanDefinition> = {
  basic: {
    key: 'basic',
    name: 'Basic',
    monthlyPriceUsd: 29,
    priceEnvKey: 'STRIPE_PRICE_BASIC_MONTHLY',
  },
  professional: {
    key: 'professional',
    name: 'Professional',
    monthlyPriceUsd: 59,
    priceEnvKey: 'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
  },
  studio: {
    key: 'studio',
    name: 'Studio',
    monthlyPriceUsd: 99,
    priceEnvKey: 'STRIPE_PRICE_STUDIO_MONTHLY',
  },
}

export function isSubscriptionTier(value: string): value is SubscriptionTier {
  return value === 'basic' || value === 'professional' || value === 'studio'
}

export function getPlanPriceId(tier: SubscriptionTier): string {
  const plan = STRIPE_PLANS[tier]
  const priceId = process.env[plan.priceEnvKey]
  if (!priceId) {
    throw new Error(`Missing env var: ${plan.priceEnvKey}`)
  }
  return priceId
}
