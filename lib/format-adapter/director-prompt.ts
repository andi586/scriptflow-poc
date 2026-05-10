import { FormatType } from './index'

export interface DirectorPromptConfig {
  format: FormatType
  rules: string[]
  structure: string
  pacing: string
  emotionalArc: string
  constraints: string[]
}

export function buildDirectorPrompt(
  format: FormatType,
  story: string,
  emotionCore?: any
): string {
  const config = getFormatConfig(format)
  
  return `
FORMAT: ${format} (${config.structure})

DIRECTOR RULES FOR THIS FORMAT:
${config.rules.join('\n')}

PACING REQUIREMENTS:
${config.pacing}

EMOTIONAL ARC:
${config.emotionalArc}

CONSTRAINTS:
${config.constraints.join('\n')}

STORY INPUT:
${story}
`
}

function getFormatConfig(format: FormatType): DirectorPromptConfig {
  switch (format) {
    case 'hook_15s':
      return {
        format: 'hook_15s',
        rules: [
          '- NO setup. Emotion explodes from frame 1.',
          '- Impact moment MUST happen before 3 seconds',
          '- Breakpoint at 3 seconds (emotional cutoff)',
          '- Maximum 4 shots, each 3-4 seconds',
          '- Every shot must have COMPLETED action (past tense)',
          '- Close-up shots required for all emotional beats',
          '- Final shot contains killer line (≤12 words)',
          '- NO slow build allowed - start at peak emotion'
        ],
        structure: '15 seconds total, 4 shots',
        pacing: 'EXPLOSIVE. No breathing room. Every second counts. Hook in first 3s, breakpoint at 3s, payoff at 12s.',
        emotionalArc: 'Start at 9/10 intensity → Peak at 10/10 → Cutoff at 3s → Resolution tease',
        constraints: [
          '- Forbid slow build',
          '- Require breakpoint at 3 seconds',
          '- Require silence beat in final shot',
          '- Maximum 4 shots total',
          '- Each shot 3-4 seconds'
        ]
      }

    case 'short_60s':
      return {
        format: 'short_60s',
        rules: [
          '- Build for 15s, turn at 30s, resolve at 50s, silence at 55s',
          '- One emotional turn required at midpoint',
          '- Allow setup in first 20% (0-12s)',
          '- Maximum 8 shots, varying duration',
          '- Dialogue allowed throughout',
          '- Silence beat required before ending',
          '- Complete emotional arc in 60 seconds',
          '- NO breakpoint/paywall logic'
        ],
        structure: '60 seconds total, 8 shots',
        pacing: 'CONTROLLED BUILD. Setup (0-15s) → Build (15-30s) → Turn (30s) → Climax (30-50s) → Resolution (50-60s)',
        emotionalArc: 'Start at 3/10 → Build to 7/10 at 30s → Peak at 9/10 at 50s → Resolve at 6/10',
        constraints: [
          '- Allow slow build in first 20%',
          '- Require emotional turn at 30 seconds',
          '- Require silence beat at 55 seconds',
          '- Maximum 8 shots total',
          '- Shot duration: 5-8 seconds each'
        ]
      }

    case 'short_3min':
      return {
        format: 'short_3min',
        rules: [
          '- Establish character flaw in first 30s',
          '- Force confrontation at 90s (midpoint)',
          '- Leave unresolved at end (open ending)',
          '- Full character arc required',
          '- Foreshadowing element in shot 1 must return in final shot',
          '- Multiple dialogue exchanges allowed',
          '- Silence beats throughout for emotional weight',
          '- Relationship change must be visible'
        ],
        structure: '180 seconds total, 16 shots',
        pacing: 'NARRATIVE. Setup (0-30s) → Rising action (30-90s) → Confrontation (90s) → Falling action (90-150s) → Resolution (150-180s)',
        emotionalArc: 'Start at 2/10 → Gradual build → Peak at 8/10 at 90s → Sustain 7/10 → End at 5/10 (unresolved)',
        constraints: [
          '- Require character flaw establishment',
          '- Require confrontation at midpoint',
          '- Require foreshadowing callback',
          '- Maximum 16 shots total',
          '- Allow multiple silence beats',
          '- Must show relationship change'
        ]
      }

    case 'mid_8min':
      return {
        format: 'mid_8min',
        rules: [
          '- Multiple emotional beats required',
          '- Characters must transform visibly',
          '- Long-term memory tracking active',
          '- Setup emotional debts early, pay off later',
          '- Multiple relationship changes',
          '- Visual symbols must recur with meaning',
          '- Dialogue-heavy scenes allowed',
          '- Silence beats for major emotional moments'
        ],
        structure: '480 seconds total, 32 shots',
        pacing: 'EPISODIC. Act 1 (0-120s) → Act 2 (120-360s) → Act 3 (360-480s). Multiple peaks and valleys.',
        emotionalArc: 'Complex multi-peak structure. Start 2/10 → Peak 1 at 8/10 (120s) → Valley 4/10 → Peak 2 at 9/10 (360s) → Resolve 6/10',
        constraints: [
          '- Require character transformation',
          '- Require multiple emotional beats',
          '- Require long-term memory callbacks',
          '- Maximum 32 shots total',
          '- Track emotional debts and payoffs'
        ]
      }

    case 'drama_20min':
      return {
        format: 'drama_20min',
        rules: [
          '- Full dramatic arc: setup, conflict, resolution',
          '- Multiple character arcs interweaving',
          '- Callbacks to earlier moments required',
          '- Emotional debts must be paid',
          '- Visual symbols with layered meaning',
          '- Dialogue carries subtext',
          '- Silence beats mark major transitions',
          '- Ending must feel earned'
        ],
        structure: '1200 seconds total, 80 shots',
        pacing: 'CINEMATIC. Three-act structure with multiple subplots. Setup (0-300s) → Conflict (300-900s) → Resolution (900-1200s)',
        emotionalArc: 'Full dramatic curve. Start 1/10 → Build gradually → Multiple peaks (7/10, 8/10, 9/10) → Final peak 10/10 at 1000s → Denouement 3/10',
        constraints: [
          '- Require full three-act structure',
          '- Require multiple character arcs',
          '- Require callbacks to setup',
          '- Maximum 80 shots total',
          '- All emotional debts must resolve'
        ]
      }

    default:
      return getFormatConfig('hook_15s')
  }
}

export function getFormatRules(format: FormatType): string[] {
  return getFormatConfig(format).rules
}

export function getFormatConstraints(format: FormatType): string[] {
  return getFormatConfig(format).constraints
}
