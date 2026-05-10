import { FORMAT_RULES, FormatType } from './index'

export function buildDirectorPrompt(
  format: FormatType,
  story: string,
  emotionCore: string
): string {
  const rules = FORMAT_RULES[format]
  
  return `You are ScriptFlow's Director Brain.
  
FORMAT: ${format} (${rules.duration} seconds)
RULE: ${rules.description}

STORY: ${story}
EMOTION CORE: ${emotionCore}

${rules.maxShots ? `MAX SHOTS: ${rules.maxShots}` : ''}
${rules.shotDuration ? `SHOT DURATIONS: ${rules.shotDuration.join('s, ')}s` : ''}
${rules.requiresEmotionPeak ? '- REQUIRED: Emotion must be at peak from FIRST FRAME' : ''}
${rules.requiresSilence ? '- REQUIRED: Include at least one silence beat' : ''}
${rules.requiresBreakpoint ? '- REQUIRED: End on unfinished emotional moment' : ''}
${rules.forbidSlowBuild ? '- FORBIDDEN: No slow build-up. No setup shots.' : ''}
${rules.requiresEmotionTurn ? '- REQUIRED: Must include one clear emotional turn' : ''}
${rules.requiresCharacterArc ? '- REQUIRED: Character must change by the end' : ''}

DIRECTOR RULES:
- Never explain the emotion. Show it.
- Use specific human details, not abstract feelings.
- Silence is stronger than dialogue.
- Cut before the answer is given.

Generate shot plan as JSON array.
Each shot: { shotNumber, duration, description, emotion, dialogue, frameType }
`
}
