export interface PayoutBreakdown {
  creatorPayout: number
  platformFee: number
  supportFund: number
  computeCost: number
  netRevenue: number
}

const SCALE_GMV_THRESHOLD = 1_000_000
const SUPPORT_FUND_RATE = 0.05

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function normalizeScore(score: number): number {
  return clamp(score, 0, 1)
}

export function getIPDecayMultiplier(videoCountInIP: number): number {
  const count = Number.isFinite(videoCountInIP) ? Math.max(1, Math.floor(videoCountInIP)) : 1
  if (count <= 5) return 1
  if (count >= 16) return 0.6
  const stepsFromSix = count - 5
  const multiplier = 1 - (stepsFromSix / 10) * 0.3
  return Math.max(0.7, Number(multiplier.toFixed(4)))
}

export function getPlatformFeeRate(gmv: number, quarter: number): number {
  const safeGMV = Number.isFinite(gmv) ? Math.max(0, gmv) : 0
  const safeQuarter = Number.isFinite(quarter) ? Math.max(1, Math.floor(quarter)) : 1
  if (safeGMV < SCALE_GMV_THRESHOLD) return 0.35
  const dynamicFloor = Math.max(0.32, 0.35 - (safeQuarter - 1) * 0.01)
  return Math.max(0.3, dynamicFloor)
}

export function calculateCreatorPayout(params: {
  totalRevenue: number
  computeCost: number
  qualityScore: number
  trustScore: number
  videoCountInIP: number
  quarter: number
}): PayoutBreakdown {
  const totalRevenue = Number.isFinite(params.totalRevenue) ? Math.max(0, params.totalRevenue) : 0
  const computeCost = Number.isFinite(params.computeCost) ? Math.max(0, params.computeCost) : 0
  const qualityScore = normalizeScore(params.qualityScore)
  const trustScore = normalizeScore(params.trustScore)
  const ipDecayMultiplier = getIPDecayMultiplier(params.videoCountInIP)
  const netRevenueRaw = Math.max(0, totalRevenue - computeCost)
  const platformFeeRate = getPlatformFeeRate(totalRevenue, params.quarter)
  const creatorPoolRate = Math.max(0, 1 - platformFeeRate - SUPPORT_FUND_RATE)
  const platformFee = roundCurrency(netRevenueRaw * platformFeeRate)
  const supportFund = roundCurrency(netRevenueRaw * SUPPORT_FUND_RATE)
  const creatorPayout = roundCurrency(netRevenueRaw * creatorPoolRate * qualityScore * trustScore * ipDecayMultiplier)
  return { creatorPayout, platformFee, supportFund, computeCost: roundCurrency(computeCost), netRevenue: roundCurrency(netRevenueRaw) }
}
