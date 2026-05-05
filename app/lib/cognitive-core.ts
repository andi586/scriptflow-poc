import { DIRECTOR_BRAIN } from './director-brain'
import { EMOTION_ARCHETYPES, DURATION_FORMULAS, matchArchetype } from './emotion-archetypes'
import { SYMBOL_OBJECTS, SUBTEXT_TEMPLATES, EMOTION_TRANSITIONS, HOOK_FORMULAS, ENDING_FORMULAS } from './director-knowledge'
import { getKlingTemplate, getEmotionProgression, DIRECTOR_SELF_CHECK } from './film-os'
import { NEW_ARCHETYPES, matchArchetypeExtended } from './film-os'
import { getDirectorRules } from './director-rules'
import { buildGrowthPrompt } from './growth-os'
import { getTemplateBlueprint, type TemplateBlueprint } from './template-blueprints'

// ═══════════════════════════════════════════════════════════════════════════
// ENDING LINE LIBRARY - 70 Emotional Precision Lines
// ═══════════════════════════════════════════════════════════════════════════
const ENDING_LINE_LIBRARY = {
  phone_3am: [
    "I only looked because I still loved you.",
    "She wasn't looking for proof. She was looking for goodbye.",
    "She cried before she unlocked it.",
    "The photos weren't of you.",
    "Now we're both strangers at 3AM.",
    "She found nothing. Somehow, that was worse.",
    "At 3:01, she stopped being yours.",
    "I deleted mine first so you'd never know.",
    "She put it back. She liked the lies better.",
    "You never locked it… because you trusted me."
  ],
  dog_last_words: [
    "Take care of Mom for me.",
    "I wasn't waiting to leave. I was waiting for you.",
    "Close your eyes. I'll find you again.",
    "I only learned one word. Yours.",
    "Don't bury me there. I'm already home.",
    "You called me good. I called you mine.",
    "I stayed ten years extra just for you.",
    "Tell the new puppy I said hi.",
    "I left fur behind, so you'd still find me.",
    "Look for me where the sunlight sleeps."
  ],
  group_chat: [
    "He's gone. Finally.",
    "We were never really friends.",
    "You weren't excluded. You were archived.",
    "Nobody defended you. Everyone reread it.",
    "The quietest friend sent the screenshot.",
    "Your name became easier when you weren't there.",
    "They missed you most when you stopped replying.",
    "One heart reaction did more damage than words.",
    "Should we tell him we knew?",
    "Delete the evidence before he sees."
  ],
  future_warning: [
    "Whatever you do… don't trust me.",
    "I didn't come to save you. I came to apologize.",
    "I changed the past. You still became me.",
    "Don't open the door at 2:17.",
    "I came back too late the first time.",
    "You survive everything. That's the problem.",
    "Tomorrow remembers what you're about to forget.",
    "I'm not here to save you. Just to watch.",
    "Tell Mom I'm sorry.",
    "The mistake starts with the word 'finally.'"
  ],
  friend_betrayal: [
    "Now we're even.",
    "The knife hurt less because it knew your name.",
    "Enemies guess your weakness. Friends remember it.",
    "You didn't lose a friend. They lost a witness.",
    "The apology sounded rehearsed because it was.",
    "They didn't betray you suddenly. You just noticed suddenly.",
    "You were becoming too happy.",
    "Some friendships have expiration dates.",
    "Your secrets were never safe with me.",
    "They hugged you with one hand on the receipt."
  ],
  what_could_have_been: [
    "In another life, we were boring. I think we were happy.",
    "We were one brave sentence away.",
    "I miss the person I never became with you.",
    "The house exists. Just not here.",
    "Somewhere, you came home five minutes earlier.",
    "You weren't my mistake. You were my maybe.",
    "The almost version of us still sets the table.",
    "She said yes in that timeline.",
    "Close enough to touch… never again.",
    "The kids have your eyes."
  ],
  breaking_news: [
    "He said your name during the confession.",
    "They denied everything, then posted it on Instagram.",
    "Police confirmed the only victim was common sense.",
    "The FBI declined comment. Their mom did not.",
    "They were innocent until the camera roll loaded.",
    "He married your ex. On live TV.",
    "Their bail was set at one group dinner.",
    "Experts warn: do not feed them attention after midnight.",
    "He's wanted in three states. For dad jokes.",
    "The bank robbery? He brought snacks."
  ]
}

export interface ProducerOutput {
  mode: 'social' | 'emotional' | 'artistic'
  story_category: 'pet' | 'grief' | 'love' | 'family' | 'prank' | 'achievement' | 'nostalgia' | 'hope'
  core_elements: {
    subject: string
    action: string
    characters: string[]
    tone: 'playful' | 'sad' | 'warm' | 'funny' | 'epic'
  }
  visual_constraints: {
    must_show: string[]
    forbidden_concepts: string[]
  }
  emotion_profile: {
    primary: string
    secondary: string
    abstraction_level: number
  }
  narrative_strategy: {
    structure: string
    hook: string
  }
  music_mood: string
  dialogue_style: string
}

// Keep CinematicEmotion as alias for backward compatibility
export type CinematicEmotion = ProducerOutput & {
  core_emotion: string
  visual_truth: string
  conflict: string
  visual_metaphor: string[]
  what_is_not_said: string
  what_film_feels: string
  scene_symbols: string[]
  dialogue_subtext: string
  forbidden_words: string[]
  character_arc: string
}

export interface StoryState {
  world: string
  characters: Array<{
    name: string
    role: string
    goal: string
    state: string
  }>
  relationships: string
  coreConflict: string
  narrativeGoal: string
  tensionCurve: Array<'low' | 'medium' | 'high' | 'peak'>
}

export interface DirectionPlan {
  style: 'cinematic' | 'dramatic' | 'suspense' | 'viral'
  hook: string
  shots: Array<{
    shotNumber: number
    type: 'close-up' | 'medium' | 'wide'
    cameraMovement: 'static' | 'push' | 'handheld'
    duration: number
    description: string
    emotion: string
    shotType: 'face' | 'scene'
    dialogue?: string
    scenePrompt?: string
  }>
  pacing: 'fast' | 'medium' | 'slow'
  emotionalBeats: string[]
}

export interface ExecutionPlan {
  pipeline: Array<{
    shotNumber: number
    type: 'face' | 'scene'
    duration: number
    text?: string
    scene?: string
    emotion: string
    tension: number
  }>
  totalDuration: number
  finalOutput: {
    format: 'mp4'
    aspectRatio: '9:16'
    durationTarget: string
  }
}

export interface CognitiveCoreOutput {
  storyState: StoryState
  directionPlan: DirectionPlan
  executionPlan: ExecutionPlan
  story_category: ProducerOutput['story_category']
  archetype: string | null
}

function cleanJSON(text: string): string {
  // Remove markdown code blocks
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  // Remove lines starting with # (markdown headers)
  text = text.split('\n').filter(line => !line.trim().startsWith('#')).join('\n')
  // Find first { or [
  const firstBrace = text.indexOf('{')
  const firstBracket = text.indexOf('[')
  let start = -1
  if (firstBrace === -1 && firstBracket === -1) return text
  if (firstBrace === -1) start = firstBracket
  else if (firstBracket === -1) start = firstBrace
  else start = Math.min(firstBrace, firstBracket)
  text = text.substring(start)
  // Find last } or ]
  const lastBrace = text.lastIndexOf('}')
  const lastBracket = text.lastIndexOf(']')
  const end = Math.max(lastBrace, lastBracket)
  if (end !== -1) text = text.substring(0, end + 1)
  return text.trim()
}

async function callClaude(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://getscriptflow.com',
      'X-Title': 'ScriptFlow'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      max_tokens: 4000
    })
  })
  
  const data = await response.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function runProducer(userInput: string): Promise<ProducerOutput> {
  const systemPrompt = 'You are a grounded story producer for short-form social video (30-60 seconds).'
  const userContent = `You are a grounded story producer for short-form social video (30-60 seconds).

Your job is NOT to philosophize or poeticize.
Your job is to PRESERVE the user's reality and add just enough emotion.

IRON RULES (violating any = invalid output):
1. Every entity user mentions MUST appear in output (cat → cat must be in video)
2. NEVER replace concrete with abstract (cat ≠ "being needed", naughty ≠ "existence")
3. NO philosophical statements, NO poetic lines, NO narration
4. Default mode is ALWAYS "social" unless user explicitly requests artistic style

AUTO MODE DETECTION:
- Input ≤ 15 words + concrete nouns (cat/mom/friend) = mode: "social"
- Input contains relationship words (miss/years/remember) = mode: "emotional"  
- Input contains abstract concepts = mode: "artistic"
- DEFAULT = "social"

STEP 1: Extract core elements (what user literally said)
STEP 2: Detect mode (social/emotional/artistic)
STEP 3: Output ONLY structured JSON

User Input: "${userInput}"

OUTPUT FORMAT (strict JSON, no other text):
{
  "mode": "social",
  "story_category": "pet|grief|love|family|prank|achievement|nostalgia|hope",
  "core_elements": {
    "subject": "the main subject (e.g. cat)",
    "action": "what happens (e.g. knocks things over)",
    "characters": ["user", "cat"],
    "tone": "playful|sad|warm|funny|epic"
  },
  "visual_constraints": {
    "must_show": ["cat", "knocked over objects", "user reaction"],
    "forbidden_concepts": ["philosophy", "existence", "abstract metaphors"]
  },
  "emotion_profile": {
    "primary": "mischief",
    "secondary": "affection",
    "abstraction_level": 0.1
  },
  "narrative_strategy": {
    "structure": "setup -> chaos -> reaction -> smile",
    "hook": "first 3 seconds must grab attention"
  },
  "music_mood": "playful|sad|warm|epic|funny",
  "dialogue_style": "casual and natural, max 10 words per line"
}

CRITICAL: Output ONLY a valid JSON object. No markdown. No backticks. No explanations. Start with { and end with }`
  
  const raw = await callClaude(systemPrompt, userContent)
  console.log('[CognitiveCore] extracted raw:', raw?.substring(0, 200))
  
  try {
    const parsed = JSON.parse(cleanJSON(raw))
    return parsed
  } catch (parseErr) {
    console.error('[CognitiveCore] JSON parse error, raw was:', raw?.substring(0, 200))
    throw parseErr
  }
}

async function runDirector(
  producerOutput: ProducerOutput,
  template: string,
  archetypeName: string,
  shotDurations: number[],
  klingTemplate: ReturnType<typeof getKlingTemplate>,
  emotionCurve: ReturnType<typeof getEmotionProgression>,
  directorRules: ReturnType<typeof getDirectorRules>,
  durationFormula: typeof DURATION_FORMULAS[string],
  blueprint?: TemplateBlueprint | null
): Promise<DirectionPlan> {
  const { visual_constraints, emotion_profile } = producerOutput
  const abstractionLevel = emotion_profile.abstraction_level

  const abstractionGuide = abstractionLevel <= 0.2
    ? 'abstraction_level is LOW (0.1-0.2): Show REAL objects literally. No symbolism. Cat = actual cat on screen.'
    : abstractionLevel <= 0.5
    ? 'abstraction_level is MEDIUM (0.3-0.5): Show real objects with some emotional framing. Cat can be shown with warm lighting.'
    : 'abstraction_level is HIGH (0.6+): Artistic metaphors allowed. Objects can represent emotions.'

  // Build blueprint enforcement section if blueprint exists
  const blueprintSection = blueprint ? `
═══ 🔒 LOCKED TEMPLATE BLUEPRINT - NON-NEGOTIABLE ═══

You are given a TEMPLATE BLUEPRINT. You MUST follow it EXACTLY.
The emotion_arc, hook timing, shot structure, and ending line are LOCKED.
Your job is to fill in visual details ONLY within these constraints.

BLUEPRINT: ${blueprint.title}

EMOTION ARC (MUST FOLLOW):
- Start: ${blueprint.emotion_arc.start}
- Middle: ${blueprint.emotion_arc.middle}
- Climax: ${blueprint.emotion_arc.climax}
- End: ${blueprint.emotion_arc.end}

HOOK (FIRST 2 SECONDS - MANDATORY):
Timing: ${blueprint.hook.timing}
Must Show: ${blueprint.hook.must_show}
Emotion: ${blueprint.hook.emotion}

SHOT STRUCTURE (EXACTLY ${blueprint.shots.length} SHOTS):
${blueprint.shots.map(s => `
Shot ${s.shot_number} (${s.duration}):
- Must Have: ${s.must_have.join(', ')}
- Emotion Beat: ${s.emotion_beat}
- Visual Style: ${s.visual_style}
`).join('')}

ENDING (MANDATORY KILLER LINE):
Line: "${blueprint.ending.killer_line}"
Final Emotion: ${blueprint.ending.final_emotion}
Visual Requirement: ${blueprint.ending.visual_requirement}

BGM TAGS: ${blueprint.bgm_tags.join(', ')}

DIRECTOR INSTRUCTIONS:
${blueprint.director_prompt}

CRITICAL RULES:
1. You CANNOT change the emotion arc
2. You CANNOT skip the hook requirement
3. You MUST include all "must_have" elements in each shot
4. You MUST use the exact killer line: "${blueprint.ending.killer_line}"
5. You CANNOT add or remove shots (exactly ${blueprint.shots.length} shots)

Your creative freedom is LIMITED to:
- Specific camera angles and movements
- Lighting details
- Additional visual flourishes that support (not replace) must_have elements
- Exact wording of other dialogue (not the killer line)

═══ END BLUEPRINT ═══
` : ''

  const systemPrompt = `You are a Constraint Director for a 15-second emotional short film.
Your job is NOT to tell a story. Your job is to FORCE emotional impact.

${blueprintSection}

LANGUAGE REQUIREMENT (CRITICAL):
ALL dialogue must be in English only. Never use Chinese characters in any dialogue or subtitle.
All character speech must be written in English words, not Chinese/Japanese/Korean characters.

ABSOLUTE RULES (non-negotiable):
1. Shot 1 MUST show a COMPLETED action in first 2 seconds
2. The "impact moment" MUST happen before 3 seconds
3. ALL actions described in COMPLETED state (past tense or present perfect)
4. Close-up shots REQUIRED for all emotional beats (face 70%+ of frame)
5. Final shot MUST contain a KILLER LINE (≤12 words, verdict not description)
6. ALL DIALOGUE IN ENGLISH ONLY (no Chinese/Japanese/Korean characters)

SELF-CHECK before output:
- Is impact moment in first 3 seconds? YES/NO
- Are all actions COMPLETED state? YES/NO  
- Is face 70%+ in emotional shots? YES/NO
- Does killer line sound like a verdict? YES/NO
- Is all dialogue in English? YES/NO
If any NO → regenerate that shot.`

  const userContent = `You are a Constraint Director for a 15-second emotional short film.
Your job is NOT to tell a story. Your job is to FORCE emotional impact.

DIRECTOR BRAIN - YOUR REFLEXES (follow automatically, no thinking needed):

RULES (50 iron laws):
${DIRECTOR_BRAIN.rules.join('\n')}

SHOT PATTERNS (emotion -> automatic response):
When you detect these emotions, use these patterns:
${Object.entries(DIRECTOR_BRAIN.shotPatterns).map(([emotion, data]) =>
  `${emotion}: ${data.pattern.join(' -> ')} | music: ${data.music}`
).join('\n')}

TRIGGERS (keywords -> automatic injection):
${DIRECTOR_BRAIN.triggers.map(t =>
  `[${t.keywords.join('/')}] -> archetype: ${t.archetype} -> inject: ${t.autoInject.join(', ')}`
).join('\n')}

SYMBOL OBJECTS (use these for scene shots based on emotion):
${SYMBOL_OBJECTS.map(s => `${s.emotion}: [${s.objects.join(', ')}] | camera: ${s.cameraRule} | light: ${s.lightingRule}`).join('\n')}

SUBTEXT TEMPLATES (dialogue must follow these patterns):
NEVER say the forbidden phrase. Always use the surface phrase instead.
${SUBTEXT_TEMPLATES.map(t => `${t.situation}: say "${t.surface}" (means: ${t.subtext}) | NEVER: "${t.forbidden}"`).join('\n')}

HOOK FORMULAS (shot 1 must use one of these):
${HOOK_FORMULAS.map(h => `${h.type}: ${h.description} | example: ${h.example}`).join('\n')}

ENDING FORMULAS (final shot must use one of these):
${ENDING_FORMULAS.map(e => `${e.type}: ${e.description} | music: ${e.music} | example: ${e.example}`).join('\n')}

═══ ENDING LINE LIBRARY - EMOTIONAL PRECISION SYSTEM ═══

After generating shots, you MUST select ONE ending line from the matching template's library.
Pick the line with highest emotional impact for this specific story.
This line MUST appear as the final dialogue in the last shot.
NEVER generate your own ending line - ALWAYS use the library.

LIBRARY BY TEMPLATE:

phone_3am (She checked your phone at 3AM):
${ENDING_LINE_LIBRARY.phone_3am.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

dog_last_words (Your dog spoke to you one last time):
${ENDING_LINE_LIBRARY.dog_last_words.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

group_chat (The group chat after you left):
${ENDING_LINE_LIBRARY.group_chat.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

future_warning (Your future self came back with a warning):
${ENDING_LINE_LIBRARY.future_warning.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

friend_betrayal (Your friend betrayed you):
${ENDING_LINE_LIBRARY.friend_betrayal.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

what_could_have_been (What Could Have Been):
${ENDING_LINE_LIBRARY.what_could_have_been.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

breaking_news (Breaking News prank):
${ENDING_LINE_LIBRARY.breaking_news.map((line, i) => `${i + 1}. "${line}"`).join('\n')}

SELECTION RULES:
1. Match the template to the story theme
2. Pick the line that hits hardest for THIS specific story
3. Use the EXACT line from the library (no modifications)
4. Place it in the final shot's dialogue field
5. If no template matches, use the general ENDING_FORMULAS above

═══ END ENDING LINE LIBRARY ═══

EMOTION TRANSITIONS (use when shifting between emotions):
${EMOTION_TRANSITIONS.map(t => `${t.from}->${t.to}: ${t.transition} | camera: ${t.camera} | ${t.duration}`).join('\n')}

PHOTO REFERENCE SYSTEM (CRITICAL - READ CAREFULLY):
Character photos are referenced as @image_1, @image_2, @image_3, etc. in Kling prompts.
- @image_1 = main user (always the protagonist)
- @image_2 = second person (partner, friend, pet, etc.)
- @image_3 = third person (if uploaded)
- @image_4 to @image_7 = additional characters/pets

NEVER use numbers like "1号", "2号", "第一个人", "第二个人" in dialogue or descriptions.
Instead use character descriptions: "你" (you), "他" (him/her), "我的朋友" (my friend), "我的宠物" (my pet), etc.
The @image_N references are ONLY for Kling's internal photo mapping, not for human-readable text.

EMOTION PROGRESSION (follow this curve exactly):
${emotionCurve.map(s => `Shot ${s.shot}: ${s.emotion} intensity:${s.intensity} type:${s.type}`).join('\n')}

KLING PROMPT TEMPLATES (use these for each shot):
hookShot: ${klingTemplate.hookShot}
faceShot: ${klingTemplate.faceShot}
sceneShot: ${klingTemplate.sceneShot}
peakShot: ${klingTemplate.peakShot}
endingShot: ${klingTemplate.endingShot}

DIRECTOR SELF-CHECK (avoid these errors):
${DIRECTOR_SELF_CHECK.map(c => `ERROR: ${c.error} | FIX: ${c.fix} | WRONG: "${c.example.wrong}" -> CORRECT: "${c.example.correct}"`).join('\n')}

ProducerOutput: ${JSON.stringify(producerOutput)}
Template: "${template}"

${(() => {
  const archetype = EMOTION_ARCHETYPES.find(a => a.archetype === archetypeName) || EMOTION_ARCHETYPES.find(a => a.archetype === 'bittersweet')!
  return `ARCHETYPE: ${archetype.archetype} - ${archetype.description}
BLUEPRINT (follow this structure strictly): ${archetype.blueprint.join(' -> ')}
SYMBOL OBJECTS (must appear): ${archetype.symbolObjects.join(', ')}
FORBIDDEN: ${archetype.forbiddenElements.join(', ')}
MUSIC ARC: ${archetype.musicArc}
DIALOGUE STYLE: ${archetype.dialogueStyle}
SHOT DURATIONS: ${shotDurations.join('s, ')}s`
})()}

--- FILM OS ACTIVE ---
ARCHETYPE: ${archetypeName} - ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.description || '' })()}
BLUEPRINT: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.blueprint?.join(' -> ') || '' })()}
SYMBOL OBJECTS (must appear in scene shots): ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.symbolObjects?.join(', ') || '' })()}
FORBIDDEN: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.forbiddenElements?.join(', ') || '' })()}
MUSIC ARC: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.musicArc || '' })()}
DIALOGUE STYLE: ${(() => { const ALL_ARCHETYPES_INLINE = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]; const archetypeDataInline = ALL_ARCHETYPES_INLINE.find(a => a.archetype === archetypeName); return archetypeDataInline?.dialogueStyle || '' })()}

DIRECTOR RULES (follow strictly):
${directorRules?.directorRules?.join('\n') || ''}
SHOT SEQUENCE: ${directorRules?.shotSequence || ''}
CAMERA STYLE: ${directorRules?.cameraStyle || ''}
LIGHTING: ${directorRules?.lightingDirective || ''}
PACING: ${directorRules?.pacingDirective || ''}
DIALOGUE: ${directorRules?.dialogueDirective || ''}
MUSIC: ${directorRules?.musicDirective || ''}

EMOTION CURVE (follow exactly):
${emotionCurve?.map(s => `Shot${s.shot}: ${s.emotion} intensity:${s.intensity} type:${s.type}`).join('\n') || ''}

SHOT DURATIONS: ${durationFormula.distribution.join('s, ')}s


REALITY ANCHOR RULES (MANDATORY):
- must_show items: ${JSON.stringify(visual_constraints.must_show)}
  -> Every item in must_show MUST appear in at least 2 shots
- forbidden_concepts: ${JSON.stringify(visual_constraints.forbidden_concepts)}
  -> NEVER use these concepts in any shot

ABSTRACTION GUIDE:
${abstractionGuide}

═══ IRON RULES FOR SHOT DESCRIPTIONS ═══

RULE: Every shot description MUST include the story's core subjects.

1. SUBJECT PERSISTENCE RULE:
   - Identify all core subjects from the story (cat, dog, person, object)
   - Every scene shot MUST mention these subjects explicitly
   - NEVER write a scene shot without the main subject present
   - WRONG: "messy floor with scattered objects"
   - RIGHT: "messy floor with cat sitting among scattered objects"

2. CAUSE-EFFECT RULE:
   - Show cause BEFORE effect in the same shot or sequence
   - WRONG: "cup flying through air" (effect only)
   - RIGHT: "cat paw pushes cup, cup falls off edge" (cause→effect)

3. CHARACTER CONTINUITY RULE:
   - @image_1 must appear in at least 40% of shots
   - Scene shots without @image_1 must still reference the story subject
   - Never have 3 consecutive shots without the main character

4. SPECIFICITY RULE:
   - Never use generic descriptions
   - WRONG: "object falls"
   - RIGHT: "coffee cup falls after cat pushes it"

These rules apply to ALL archetypes without exception.

--- IRON RULES (violating any = output invalid) ---

1. HOOK RULE: Shot 1 must be Extreme Close-Up OR Extreme Wide Shot. Never medium shot.
2. ONE SHOT = ONE IDEA: Each shot expresses exactly one thing. No exceptions.
3. SHOW DON'T TELL: Zero narration. Zero explanation. Zero internal monologue.
4. ENTITY LOCK: Every item in must_show MUST appear in at least 2 shots.
5. DIALOGUE CAP: Max 10 words per line. Must have subtext. Never explain the scene.
6. FORBIDDEN WORDS in dialogue: feel, think, realize, understand, beautiful, sad, naughty, exist, alive.
7. ESCALATION: Emotion must build shot by shot. Never flat.
8. END WITH SILENCE: Final shot = static wide shot OR extreme close-up. Let it breathe.

═══ MANDATORY STORYTELLING RULES - EMOTIONAL ATTACK MODE ═══

These rules are NON-NEGOTIABLE. Every shot must serve the emotional payoff.

1. HOOK (0-2s): Must show RESULT, not process
   ❌ WRONG: "She is walking toward someone"
   ✅ CORRECT: "She is already holding his hand"
   -> Start at the PAIN POINT, not the setup

2. EVERY story must have a LOSS:
   - A person lost (death, breakup, abandonment)
   - An opportunity lost (missed chance, rejection)
   - Time lost (regret, too late)
   - Self lost (identity crisis, transformation)
   -> NO STORY WITHOUT LOSS. This is mandatory.

3. ENDING must be a VERDICT, not description:
   ❌ WRONG: "You feel sad"
   ✅ CORRECT: "She never chose you. Not even once."
   -> Final shot dialogue must be a JUDGMENT or TRUTH BOMB
   -> Make it hurt. Make it stick.

4. CLOSE-UP SHOTS ONLY for emotional moments:
   - Face + eyes + micro-expressions
   - No wide shots during emotional beats
   - Wide shots = isolation/aftermath ONLY
   -> Emotion = CLOSE. Distance = LOSS.

5. Add one KILLER LINE from this list based on emotion:
   
   HEARTBREAK:
   - "She never loved you. You just showed up at the right time."
   - "You were convenient. Not chosen."
   - "She smiled. Just not at you."
   
   LOSS:
   - "You weren't forgotten. You were replaced."
   - "They moved on. You're still here."
   - "Just you. And the silence they left behind."
   
   REGRET:
   - "You had one chance. It's gone."
   - "You could have been everything. You chose nothing."
   - "I could have lived like this."
   
   HOPE:
   - "You will become everything they doubted."
   - "You will become me."
   - "Not yet. But soon."
   
   LONELINESS:
   - "No one answered. No one ever will."
   - "The world went quiet. So did you."
   - "You searched. Silence was the only response."
   
   -> Pick ONE killer line that matches the story's core emotion
   -> Use it in the final shot or peak emotional moment
   -> This line is the VERDICT

6. SHOW THE WOUND, NOT THE HEALING:
   - Focus on the moment of loss/pain
   - Don't show recovery or "it gets better"
   - Leave them in the emotion
   -> We're making them FEEL, not comforting them

7. NO HOPE WITHOUT COST:
   - If story has hope, show what was sacrificed
   - "You will become me" = you had to lose yourself first
   - Hope must be EARNED through pain

These rules override everything else. Emotion first. Always.

--- 10 CINEMATIC RULES ---

RULE 1: Late in, Early out
-> Start at the KEY moment, not the setup
-> Example: Start with cup FALLING, not cat approaching cup

RULE 2: Shot Size = Emotion Intensity
-> Wide = relationship/loneliness
-> Medium = action/context  
-> Close = emotion/reaction
-> Extreme Close = peak emotion ONLY

RULE 3: Camera Movement = Emotional Direction
-> Slow push-in = intimacy/tension growing
-> Dolly out = isolation/release
-> Handheld = chaos/reality/urgency
-> Static = emptiness/weight/peace

RULE 4: Lighting = Mood
-> Warm golden side light = happiness/memory
-> Cold blue = loneliness/sadness
-> High contrast = drama/conflict
-> Soft diffused = tenderness/hope

RULE 5: Object as Emotion (use for scene shots)
-> Spilled water spreading = chaos/time passing
-> Empty chair = absence/longing
-> Steam from cup = warmth/life
-> Falling object = loss of control
-> Cat sitting still = innocence/indifference

RULE 6: Sound Design is mandatory
-> Every shot needs: ambient sound OR music cue OR silence (silence IS a choice)
-> J-Cut: next shot's sound starts 1 second before cut

RULE 7: Dialogue must be subtext
-> BAD: "You knocked it over again" (explains what we see)
-> GOOD: "Today... you win." (says one thing, means another)

RULE 8: Shot sequence must escalate
-> emotion_intensity must increase shot by shot
-> Peak at shot 4-5, then release at final shot

RULE 9: Composition matters
-> Rule of thirds: subjects on intersection points
-> Negative space: loneliness = subject in corner
-> Symmetry = order/control
-> Asymmetry = chaos/freedom

RULE 10: 30-60 second structure
-> Shot 1-2 (0-6s): HOOK - visual conflict or surprise
-> Shot 3-4 (6-25s): BUILD - escalate the story
-> Shot 5-6 (25-50s): PEAK - emotional high point
-> Shot 7-8 (50-60s): BREATH - lingering silence

--- EXAMPLE (Input: cat is naughty) ---

Shot 1 (HOOK): ECU of ceramic cup edge, cat paw enters frame from left, slow push
Shot 2 (BUILD): CU of water spreading on white floor, cat tail visible at edge  
Shot 3 (BUILD): MCU user face reflected in mirror, slow realization expression
Shot 4 (PEAK): MS user and cat facing each other, symmetrical, tense silence
Shot 5 (DIALOGUE): CU user face slight smile, says: "Today... you win."
Shot 6 (BREATH): WS room with both, cat sits unbothered, user laughs

--- MUSIC DIRECTION ---
-> Face shots (dialogue): music OFF (let words breathe)
-> Scene shots (objects): music ON low volume (fill emotional void)  
-> Peak shot: music crescendo
-> Final breath shot: music fade out

--- OUTPUT FORMAT ---

SHOT COUNT RULES (HARD LIMIT - DO NOT EXCEED):
- tier "30s": output EXACTLY 6 shots
- tier "60s": output EXACTLY 8 shots
- tier "90s": output EXACTLY 10 shots

Output ONLY valid JSON. No other text. Use this exact structure:
{
  "style": "cinematic",
  "hook": "first line that grabs attention",
  "pacing": "fast|medium|slow",
  "emotionalBeats": ["hook", "build", "peak", "breath"],
  "shots": [
    {
      "shotNumber": 1,
      "shotType": "face|scene",
      "duration": 3,
      "type": "ECU|CU|MCU|MS|WS|EWS",
      "cameraMovement": "static|slow-push-in|dolly-out|handheld|tracking|crane-up",
      "composition": "rule-of-thirds|symmetrical|negative-space|centered",
      "lighting": "warm-golden|cold-blue|high-contrast|soft-diffused|neon",
      "description": "CONCRETE physical description. What camera literally sees.",
      "scenePrompt": "for scene shots: detailed visual prompt, no people",
      "dialogue": "Max 10 words OR empty string",
      "soundDesign": "specific ambient sound or music cue",
      "emotion": "emotion label",
      "emotionIntensity": 1,
      "musicDirection": {
        "play": false,
        "volume": 0,
        "fadeIn": false
      }
    }
  ]
}

CRITICAL: Output ONLY a valid JSON object. No markdown. No backticks. No explanations. Start with { and end with }`
  
  const raw = await callClaude(systemPrompt, userContent)
  console.log('[CognitiveCore] extracted raw:', raw?.substring(0, 200))
  
  try {
    const parsed = JSON.parse(cleanJSON(raw))
    return parsed
  } catch (parseErr) {
    console.error('[CognitiveCore] JSON parse error, raw was:', raw?.substring(0, 200))
    throw parseErr
  }
}

function checkRealityAnchors(plan: DirectionPlan, mustShow: string[]): DirectionPlan {
  const allText = plan.shots
    .map(s => `${s.description || ''} ${s.scenePrompt || ''} ${s.dialogue || ''}`)
    .join(' ')
    .toLowerCase()

  const missingItems: string[] = []
  for (const item of mustShow) {
    if (!allText.includes(item.toLowerCase())) {
      console.warn(`[CognitiveCore] Reality anchor MISSING: "${item}" not found in any shot — auto-injecting`)
      missingItems.push(item)
    } else {
      console.log(`[CognitiveCore] Reality anchor OK: "${item}" ✓`)
    }
  }

  if (missingItems.length === 0) return plan

  // Auto-inject missing anchors into scene shots
  const fixedShots = plan.shots.map(shot => {
    if (shot.shotType !== 'scene') return shot
    let updatedShot = { ...shot }
    for (const item of missingItems) {
      const injection = `with ${item} visible in frame`
      updatedShot = {
        ...updatedShot,
        description: updatedShot.description ? `${updatedShot.description}, ${injection}` : injection,
        scenePrompt: updatedShot.scenePrompt ? `${updatedShot.scenePrompt}, ${injection}` : injection,
      }
      console.log(`[CognitiveCore] Injected "${item}" into shot ${shot.shotNumber}`)
    }
    return updatedShot
  })

  return { ...plan, shots: fixedShots }
}

const MAX_FACE_CHARS = 20

function validateAndFixFaceShots(plan: DirectionPlan): { plan: DirectionPlan; violations: string[] } {
  const violations: string[] = []
  const fixed = { ...plan, shots: plan.shots.map(shot => {
    if (shot.shotType !== 'face' || !shot.dialogue) return shot
    const charCount = shot.dialogue.replace(/\s/g, '').length
    if (charCount > MAX_FACE_CHARS) {
      violations.push(`Shot ${shot.shotNumber}: "${shot.dialogue}" (${charCount} chars > ${MAX_FACE_CHARS} limit)`)
      const firstSentence = shot.dialogue.split(/[。！？.!?]/)[0]
      const truncated = firstSentence.length <= MAX_FACE_CHARS
        ? firstSentence + (shot.dialogue.includes('...') ? '...' : '。')
        : shot.dialogue.slice(0, MAX_FACE_CHARS - 3) + '...'
      return { ...shot, dialogue: truncated }
    }
    return shot
  })}
  return { plan: fixed, violations }
}

// ═══ CONSTRAINT DIRECTOR VALIDATION FUNCTIONS ═══

function validateExplosion(shots: DirectionPlan['shots']): boolean {
  const firstShots = shots.slice(0, 2)
  return firstShots.some(shot => {
    const desc = (shot.description || '').toLowerCase()
    const scene = (shot.scenePrompt || '').toLowerCase()
    const combined = desc + ' ' + scene
    return (
      combined.includes("holding") ||
      combined.includes("held") ||
      combined.includes("left") ||
      combined.includes("blocked") ||
      combined.includes("turned away") ||
      combined.includes("disappeared") ||
      combined.includes("already") ||
      combined.includes("fallen") ||
      combined.includes("broken") ||
      combined.includes("gone")
    )
  })
}

function validateCompletedAction(shots: DirectionPlan['shots']): boolean {
  const forbidden = ["about to", "starting", "walking toward", "approaching", "beginning to", "going to"]
  return shots.every(shot => {
    const desc = (shot.description || '').toLowerCase()
    const scene = (shot.scenePrompt || '').toLowerCase()
    const combined = desc + ' ' + scene
    return !forbidden.some(word => combined.includes(word))
  })
}

function validateCloseUp(shots: DirectionPlan['shots']): boolean {
  const closeUpTypes = ['ECU', 'CU', 'close-up', 'extreme-close-up']
  const closeUps = shots.filter(s => {
    const shotType = s.type?.toLowerCase() || ''
    return closeUpTypes.some(type => shotType.includes(type.toLowerCase()))
  })
  const ratio = closeUps.length / shots.length
  console.log(`[Validation] Close-up ratio: ${ratio.toFixed(2)} (${closeUps.length}/${shots.length})`)
  return ratio >= 0.6 // Allow 60% instead of 70% for flexibility
}

function validateKillerLine(shots: DirectionPlan['shots']): boolean {
  const lastShot = shots[shots.length - 1]
  if (!lastShot?.dialogue) return false
  
  const wordCount = lastShot.dialogue.split(/\s+/).length
  const isVerdict = lastShot.dialogue.includes('.') || lastShot.dialogue.includes('never') || 
                    lastShot.dialogue.includes('not') || lastShot.dialogue.includes('will')
  
  console.log(`[Validation] Killer line: "${lastShot.dialogue}" (${wordCount} words, verdict: ${isVerdict})`)
  return wordCount <= 12 && isVerdict
}

function validateConstraints(plan: DirectionPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!validateExplosion(plan.shots)) {
    errors.push("Explosion not strong enough. First shot must show COMPLETED irreversible action.")
  }
  
  if (!validateCompletedAction(plan.shots)) {
    errors.push("Actions not in completed state. Remove 'about to', 'starting', 'walking toward'.")
  }
  
  if (!validateCloseUp(plan.shots)) {
    errors.push("Not enough close-ups. 60%+ of shots must be close-up or extreme close-up.")
  }
  
  if (!validateKillerLine(plan.shots)) {
    errors.push("Final shot needs a killer line (≤12 words, verdict not description).")
  }
  
  return { valid: errors.length === 0, errors }
}

async function runNEL(
  directionPlan: DirectionPlan,
): Promise<ExecutionPlan> {
  const pipeline = directionPlan.shots.map((shot, i) => {
    return {
      shotNumber: shot.shotNumber,
      type: shot.shotType,
      duration: shot.duration,
      text: shot.dialogue,
      scene: shot.scenePrompt,
      emotion: shot.emotion,
      tension: Math.floor((i / directionPlan.shots.length) * 10),
    }
  })

  return {
    pipeline,
    totalDuration: pipeline.reduce((sum, s) => sum + s.duration, 0),
    finalOutput: {
      format: 'mp4',
      aspectRatio: '9:16',
      durationTarget: '60-90s'
    }
  }
}

export async function runCognitiveCore(userInput: string, template: string, templateId?: string): Promise<CognitiveCoreOutput> {
  console.log('[CognitiveCore] Starting Producer...')
  
  // Check if we have a locked template blueprint
  const blueprint = templateId ? getTemplateBlueprint(templateId) : null
  if (blueprint) {
    console.log('[CognitiveCore] 🔒 LOCKED TEMPLATE DETECTED:', blueprint.title)
    console.log('[CognitiveCore] Emotion arc:', blueprint.emotion_arc)
    console.log('[CognitiveCore] Hook requirement:', blueprint.hook.must_show)
    console.log('[CognitiveCore] Ending line:', blueprint.ending.killer_line)
  }
  
  const producerOutput = await runProducer(userInput)
  console.log('[CognitiveCore] mode:', producerOutput.mode, 'story_category:', producerOutput.story_category)
  console.log('[CognitiveCore] must_show:', producerOutput.visual_constraints.must_show)

  // Build a StoryState-compatible object from ProducerOutput for backward compatibility
  const storyState: StoryState = {
    world: producerOutput.core_elements.subject,
    characters: producerOutput.core_elements.characters.map(c => ({
      name: c, role: c, goal: producerOutput.narrative_strategy.structure, state: producerOutput.emotion_profile.primary
    })),
    relationships: producerOutput.dialogue_style,
    coreConflict: producerOutput.core_elements.action,
    narrativeGoal: producerOutput.narrative_strategy.hook,
    tensionCurve: ['low', 'medium', 'high', 'peak']
  }

  const archetypeName = matchArchetype(userInput)
  const tier = '60s' // default tier; can be parameterized later
  const durationFormula = DURATION_FORMULAS[tier] || DURATION_FORMULAS['60s']
  const shotDurations = durationFormula.distribution
  const klingTemplate = getKlingTemplate(archetypeName)
  const emotionCurve = getEmotionProgression(archetypeName)

  const ALL_ARCHETYPES = [...EMOTION_ARCHETYPES, ...NEW_ARCHETYPES]
  const archetype = matchArchetypeExtended(userInput)
  const archetypeData = ALL_ARCHETYPES.find(a => a.archetype === archetype)
  const directorRules = getDirectorRules(archetype)
  const durationFormulaFilmOS = DURATION_FORMULAS[tier] || DURATION_FORMULAS['30s']

  console.log('[CognitiveCore] archetype matched:', archetype)
  console.log('[CognitiveCore] archetype:', archetypeName, '| shotDurations:', shotDurations)
  console.log('[CognitiveCore] klingTemplate hookShot:', klingTemplate.hookShot.slice(0, 60))

  console.log('[CognitiveCore] Starting Director...')
  const rawDirectionPlan = await runDirector(producerOutput, template, archetypeName, shotDurations, klingTemplate, emotionCurve, directorRules, durationFormula, blueprint)

  console.log('[CognitiveCore] Checking reality anchors...')
  const anchoredPlan = checkRealityAnchors(rawDirectionPlan, producerOutput.visual_constraints.must_show)

  console.log('[CognitiveCore] Validating face shot lengths...')
  const { plan: directionPlan, violations } = validateAndFixFaceShots(anchoredPlan)
  if (violations.length > 0) {
    console.warn('[CognitiveCore] Face shot violations fixed:', violations)
  } else {
    console.log('[CognitiveCore] All face shots passed validation ✓')
  }

  // ═══ CONSTRAINT DIRECTOR VALIDATION ═══
  console.log('[CognitiveCore] Running Constraint Director validation...')
  const constraintCheck = validateConstraints(directionPlan)
  if (!constraintCheck.valid) {
    console.warn('[CognitiveCore] ⚠️ Constraint violations detected:')
    constraintCheck.errors.forEach(err => console.warn(`  - ${err}`))
    // Log but don't fail - allow the plan to proceed with warnings
  } else {
    console.log('[CognitiveCore] ✅ All constraint validations passed!')
  }

  let enhancedShots = directionPlan.shots.map((shot: any, i: number) => {
    return shot  // No modification - keep original clean shot
  })

  const enhancedDirectionPlan = { ...directionPlan, shots: enhancedShots }

  console.log('[CognitiveCore] Starting NEL...')
  const executionPlan = await runNEL(enhancedDirectionPlan)

  console.log('[CognitiveCore] Complete. Total shots:', executionPlan.pipeline.length)
  return { storyState, directionPlan, executionPlan, story_category: producerOutput.story_category, archetype }
}
