export interface PotentialScore {
  total: number
  qualityScore: number
  trustScore: number
  exposureInverse: number
  noveltyBonus: number
  isColdStart: boolean
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10000) / 10000
}

function normalizeUnitScore(value: number): number {
  return clamp(value, 0, 1)
}

function calculateExposureInverse(currentViews: number, platformMedianViews: number): number {
  const safeCurrentViews = Number.isFinite(currentViews) ? Math.max(0, currentViews) : 0
  const safeMedianViews = Number.isFinite(platformMedianViews) ? Math.max(0, platformMedianViews) : 0
  if (safeMedianViews <= 0) return 1
  if (safeCurrentViews <= 0) return 1
  const ratio = safeCurrentViews / safeMedianViews
  return roundScore(clamp(1 - clamp(ratio, 0, 1), 0, 1))
}

export function checkColdStartSwitch(totalPlatformVideos: number): boolean {
  const safeTotal = Number.isFinite(totalPlatformVideos) ? Math.max(0, Math.floor(totalPlatformVideos)) : 0
  return safeTotal < 100_000
}

export function calculatePotentialScore(params: {
  qualityScore: number
  trustScore: number
  currentViews: number
  platformMedianViews: number
  noveltyBonus: number
  totalPlatformVideos: number
}): PotentialScore {
  const qualityScore = normalizeUnitScore(params.qualityScore)
  const trustScore = normalizeUnitScore(params.trustScore)
  const noveltyBonus = normalizeUnitScore(params.noveltyBonus)
  const exposureInverse = calculateExposureInverse(params.currentViews, params.platformMedianViews)
  const isColdStart = checkColdStartSwitch(params.totalPlatformVideos)
  const weights = isColdStart
    ? { quality: 0.35, trust: 0.25, exposureInverse: 0.25, novelty: 0.15 }
    : { quality: 0.45, trust: 0.30, exposureInverse: 0.15, novelty: 0.10 }
  const total = qualityScore * weights.quality + trustScore * weights.trust + exposureInverse * weights.exposureInverse + noveltyBonus * weights.novelty
  return {
    total: roundScore(clamp(total, 0, 1)),
    qualityScore: roundScore(qualityScore),
    trustScore: roundScore(trustScore),
    exposureInverse: roundScore(exposureInverse),
    noveltyBonus: roundScore(noveltyBonus),
    isColdStart,
  }
}
