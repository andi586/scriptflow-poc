export interface HookBlueprint {
  hook_line_1: string
  hook_line_2: string
  hook_line_3: string
  breakpoint_line: string
  human_detail: string
  silence_moment: string
  emotional_contradiction: string
  cta: string
  shot_plan: Array<{
    second: number
    shot: string
    emotion: string
    visual: string
    subtitle: string
  }>
}

export interface BlueprintScore {
  total: number
  verdict: 'kill' | 'market_test' | 'approved'
  breakdown: {
    hook_impact: number
    human_detail: number
    silence: number
    contradiction: number
    shot_quality: number
  }
  issues: string[]
}

export function scoreHookBlueprint(blueprint: HookBlueprint): BlueprintScore {
  const issues: string[] = []
  let total = 0
  
  const breakdown = {
    hook_impact: 0,
    human_detail: 0,
    silence: 0,
    contradiction: 0,
    shot_quality: 0
  }

  // 1. Hook Impact (0-3 points)
  const hookLines = [blueprint.hook_line_1, blueprint.hook_line_2, blueprint.hook_line_3]
  const hasStrongHook = hookLines.some(line => {
    const wordCount = line.split(' ').length
    const hasEmotionalWords = /never|always|lost|gone|left|alone|last|final|end/.test(line.toLowerCase())
    return wordCount <= 8 && hasEmotionalWords
  })
  
  if (hasStrongHook) {
    breakdown.hook_impact = 3
  } else if (hookLines.every(line => line.split(' ').length <= 10)) {
    breakdown.hook_impact = 1
    issues.push('Hook lacks emotional punch')
  } else {
    breakdown.hook_impact = 0
    issues.push('Hook lines too long')
  }

  // 2. Human Detail (0-2 points)
  const hasSpecificDetail = blueprint.human_detail && 
    blueprint.human_detail.length > 5 && 
    !blueprint.human_detail.includes('generic') &&
    !blueprint.human_detail.includes('abstract')
  
  if (hasSpecificDetail) {
    breakdown.human_detail = 2
  } else {
    breakdown.human_detail = 0
    issues.push('Human detail too generic')
  }

  // 3. Silence Moment (0-2 points)
  const hasSilence = blueprint.silence_moment && 
    blueprint.silence_moment.length > 10 &&
    (blueprint.silence_moment.includes('pause') || 
     blueprint.silence_moment.includes('silence') ||
     blueprint.silence_moment.includes('quiet'))
  
  if (hasSilence) {
    breakdown.silence = 2
  } else {
    breakdown.silence = 0
    issues.push('No clear silence moment')
  }

  // 4. Emotional Contradiction (0-2 points)
  const hasContradiction = blueprint.emotional_contradiction &&
    blueprint.emotional_contradiction.length > 15 &&
    (blueprint.emotional_contradiction.includes('but') ||
     blueprint.emotional_contradiction.includes('yet') ||
     blueprint.emotional_contradiction.includes('though'))
  
  if (hasContradiction) {
    breakdown.contradiction = 2
  } else {
    breakdown.contradiction = 1
    issues.push('Weak emotional contradiction')
  }

  // 5. Shot Quality (0-3 points)
  const hasValidShots = blueprint.shot_plan && 
    blueprint.shot_plan.length === 4 &&
    blueprint.shot_plan.every(shot => 
      shot.visual && shot.visual.length > 10 &&
      shot.subtitle && shot.subtitle.split(' ').length <= 10
    )
  
  if (hasValidShots) {
    breakdown.shot_quality = 3
  } else if (blueprint.shot_plan && blueprint.shot_plan.length === 4) {
    breakdown.shot_quality = 1
    issues.push('Shot descriptions need improvement')
  } else {
    breakdown.shot_quality = 0
    issues.push('Invalid shot plan')
  }

  // Calculate total
  total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)

  // Determine verdict
  let verdict: 'kill' | 'market_test' | 'approved'
  if (total <= 4) {
    verdict = 'kill'
  } else if (total <= 8) {
    verdict = 'market_test'
  } else {
    verdict = 'approved'
  }

  return {
    total,
    verdict,
    breakdown,
    issues
  }
}
