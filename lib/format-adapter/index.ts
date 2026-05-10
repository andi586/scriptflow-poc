export type FormatType = 
  | "hook_15s" 
  | "short_60s" 
  | "short_3min" 
  | "mid_8min" 
  | "drama_20min"

export interface FormatRules {
  duration: number
  maxShots?: number
  shotDuration?: number[] | null
  requiresEmotionPeak?: boolean
  requiresSilence?: boolean
  requiresBreakpoint?: boolean
  forbidSlowBuild?: boolean
  requiresEmotionTurn?: boolean
  requiresCharacterArc?: boolean
  requiresRelationshipChange?: boolean
  requiresLongMemory?: boolean
  requiresCallbacks?: boolean
  description: string
}

export const FORMAT_RULES: Record<FormatType, FormatRules> = {
  hook_15s: {
    duration: 15,
    maxShots: 4,
    shotDuration: [3, 4, 4, 4],
    requiresEmotionPeak: true,
    requiresSilence: true,
    requiresBreakpoint: true,
    forbidSlowBuild: true,
    description: "Emotion explosion from frame 1. No setup."
  },
  short_60s: {
    duration: 60,
    maxShots: 8,
    shotDuration: [5, 8, 8, 8, 8, 8, 8, 7],
    requiresEmotionTurn: true,
    requiresSilence: true,
    requiresBreakpoint: false,
    forbidSlowBuild: false,
    description: "One emotional turn. Complete arc in 60 seconds."
  },
  short_3min: {
    duration: 180,
    maxShots: 16,
    shotDuration: null,
    requiresCharacterArc: true,
    requiresEmotionTurn: true,
    requiresSilence: true,
    description: "Full character arc. One relationship change."
  },
  mid_8min: {
    duration: 480,
    maxShots: 32,
    requiresCharacterArc: true,
    requiresRelationshipChange: true,
    requiresLongMemory: true,
    description: "Multiple emotional beats. Characters transform."
  },
  drama_20min: {
    duration: 1200,
    maxShots: 80,
    requiresCharacterArc: true,
    requiresRelationshipChange: true,
    requiresLongMemory: true,
    requiresCallbacks: true,
    description: "Full dramatic arc. Setup, conflict, resolution."
  }
}

export function getFormatRules(format: FormatType) {
  return FORMAT_RULES[format]
}
