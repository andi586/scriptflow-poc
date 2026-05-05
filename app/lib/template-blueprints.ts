/**
 * EMOTIONAL BLUEPRINT SYSTEM
 * 
 * Each template is a locked emotional structure that the Director MUST follow.
 * The Director cannot deviate from:
 * - emotion_arc (the emotional journey)
 * - hook timing (first 2 seconds)
 * - shot structure (4 shots with must_have constraints)
 * - ending killer line
 */

export interface TemplateBlueprint {
  id: string
  title: string
  emotion_arc: {
    start: string
    middle: string
    climax: string
    end: string
  }
  bgm_tags: string[]
  hook: {
    timing: string // "0-2s"
    must_show: string
    emotion: string
  }
  shots: Array<{
    shot_number: number
    duration: string
    must_have: string[]
    emotion_beat: string
    visual_style: string
  }>
  ending: {
    killer_line: string
    final_emotion: string
    visual_requirement: string
  }
  director_prompt: string
}

export const TEMPLATE_BLUEPRINTS: Record<string, TemplateBlueprint> = {
  parallel_universe: {
    id: "parallel_universe",
    title: "You met your future self… and he warned you",
    emotion_arc: {
      start: "curiosity",
      middle: "recognition",
      climax: "existential dread",
      end: "haunting acceptance"
    },
    bgm_tags: ["ambient", "mysterious", "ethereal", "tension"],
    hook: {
      timing: "0-2s",
      must_show: "Two versions of @image_1 facing each other in a liminal space",
      emotion: "uncanny recognition"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 in normal clothes", "mundane setting", "ordinary moment"],
        emotion_beat: "normalcy before the shift",
        visual_style: "warm, grounded, realistic"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["@image_1 in different clothes", "same person but different life", "visual contrast"],
        emotion_beat: "the other life revealed",
        visual_style: "cooler tones, slightly surreal"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["both versions of @image_1", "eye contact between them", "moment of recognition"],
        emotion_beat: "the confrontation",
        visual_style: "dramatic lighting, close-ups"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 alone", "changed expression", "weight of knowledge"],
        emotion_beat: "aftermath of truth",
        visual_style: "muted colors, contemplative"
      }
    ],
    ending: {
      killer_line: "Some doors should stay closed.",
      final_emotion: "haunting regret",
      visual_requirement: "@image_1 walking away from a mirror/portal, never looking back"
    },
    director_prompt: "This is a story about parallel lives and the weight of choices not made. The hook MUST show two versions of the same person in the first 2 seconds. Build tension through visual contrast between the two lives. The ending line 'Some doors should stay closed' must land with finality. Focus on the uncanny feeling of meeting yourself."
  },

  she_didnt_choose_you: {
    id: "she_didnt_choose_you",
    title: "She checked your phone at 3AM",
    emotion_arc: {
      start: "intimacy",
      middle: "suspicion",
      climax: "betrayal",
      end: "cold silence"
    },
    bgm_tags: ["melancholic", "piano", "heartbreak", "tension"],
    hook: {
      timing: "0-2s",
      must_show: "Phone screen glowing in darkness, @image_1's face illuminated by blue light",
      emotion: "dread and discovery"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 sleeping peacefully", "phone on nightstand", "3AM timestamp visible"],
        emotion_beat: "false security",
        visual_style: "dark, intimate, peaceful"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["hand reaching for phone", "screen unlocking", "@image_1 still asleep in background"],
        emotion_beat: "the violation begins",
        visual_style: "blue phone glow, shadows, tension"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["@image_1's face", "realization dawning", "phone screen reflection in eyes"],
        emotion_beat: "the truth revealed",
        visual_style: "close-up, harsh light, raw emotion"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 sitting on edge of bed", "phone face down", "distance between people"],
        emotion_beat: "aftermath",
        visual_style: "cold, distant, empty"
      }
    ],
    ending: {
      killer_line: "Trust doesn't come back.",
      final_emotion: "irreversible damage",
      visual_requirement: "@image_1 alone in frame, phone dark, relationship over"
    },
    director_prompt: "This is about the moment trust dies. The hook MUST show the phone glowing at 3AM in the first 2 seconds. Build the violation through POV shots of scrolling. The ending line 'Trust doesn't come back' must feel final and cold. Focus on the intimacy betrayed."
  },

  future_you: {
    id: "future_you",
    title: "Your future self came back… with a warning",
    emotion_arc: {
      start: "confusion",
      middle: "urgency",
      climax: "desperate plea",
      end: "haunting responsibility"
    },
    bgm_tags: ["dramatic", "orchestral", "urgent", "epic"],
    hook: {
      timing: "0-2s",
      must_show: "Older @image_1 appearing suddenly, grabbing younger @image_1's shoulder",
      emotion: "shock and urgency"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["young @image_1", "ordinary moment", "about to make a decision"],
        emotion_beat: "the crossroads",
        visual_style: "bright, normal, unaware"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["older @image_1 appears", "weathered face", "desperate eyes"],
        emotion_beat: "the intervention",
        visual_style: "dramatic lighting, time distortion effects"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["both versions of @image_1", "intense eye contact", "warning being delivered"],
        emotion_beat: "the message",
        visual_style: "close-ups, urgent, emotional"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["young @image_1 alone", "older self vanished", "weight of knowledge"],
        emotion_beat: "the burden",
        visual_style: "somber, heavy, contemplative"
      }
    ],
    ending: {
      killer_line: "Don't make my mistakes.",
      final_emotion: "heavy responsibility",
      visual_requirement: "@image_1 standing at the same crossroads, now aware, choosing differently"
    },
    director_prompt: "This is about warnings from the future and the weight of knowledge. The hook MUST show the older self appearing in the first 2 seconds. Build urgency through the older self's desperation. The ending line 'Don't make my mistakes' must carry the weight of lived regret. Focus on the age difference and wisdom in the older self's eyes."
  },

  lost_someone: {
    id: "lost_someone",
    title: "Your dog spoke to you one last time",
    emotion_arc: {
      start: "ordinary love",
      middle: "impossible moment",
      climax: "bittersweet goodbye",
      end: "grateful grief"
    },
    bgm_tags: ["emotional", "piano", "bittersweet", "gentle"],
    hook: {
      timing: "0-2s",
      must_show: "@image_1 hearing their dog's voice for the first time",
      emotion: "impossible wonder"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 with dog", "normal day", "routine moment"],
        emotion_beat: "taken-for-granted love",
        visual_style: "warm, soft, everyday"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["dog looking at @image_1", "moment of connection", "something different"],
        emotion_beat: "the impossible begins",
        visual_style: "golden hour, magical realism"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["@image_1's face", "tears", "understanding", "dog's final message"],
        emotion_beat: "the goodbye",
        visual_style: "close-up, emotional, tender"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 alone", "dog's collar/toy", "memory"],
        emotion_beat: "the gift of closure",
        visual_style: "soft light, peaceful, grateful"
      }
    ],
    ending: {
      killer_line: "Thank you for being my human.",
      final_emotion: "grateful grief",
      visual_requirement: "@image_1 holding dog's collar, smiling through tears"
    },
    director_prompt: "This is about the goodbye we never get to say. The hook MUST show the moment of impossible communication in the first 2 seconds. Build the magic through the dog's perspective. The ending line 'Thank you for being my human' must break hearts gently. Focus on unconditional love and the gift of closure."
  },

  last_person: {
    id: "last_person",
    title: "The group chat after you left",
    emotion_arc: {
      start: "belonging",
      middle: "exclusion",
      climax: "betrayal",
      end: "cold clarity"
    },
    bgm_tags: ["dark", "electronic", "unsettling", "modern"],
    hook: {
      timing: "0-2s",
      must_show: "Phone screen showing 'You have been removed from the group'",
      emotion: "sudden exclusion"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 in group photo", "smiling", "feeling included"],
        emotion_beat: "false belonging",
        visual_style: "bright, social, warm"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["phone screen", "messages continuing without @image_1", "notification: removed"],
        emotion_beat: "the exclusion",
        visual_style: "cold phone glow, UI elements, digital"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["@image_1's face", "reading messages about them", "realization"],
        emotion_beat: "what they really think",
        visual_style: "harsh light, close-up, raw"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 alone", "phone face down", "new clarity"],
        emotion_beat: "liberation through truth",
        visual_style: "stark, clean, independent"
      }
    ],
    ending: {
      killer_line: "Real friends don't need a group chat.",
      final_emotion: "empowered solitude",
      visual_requirement: "@image_1 deleting the app, walking away, unbothered"
    },
    director_prompt: "This is about social betrayal and finding strength in exclusion. The hook MUST show the removal notification in the first 2 seconds. Build the betrayal through message screenshots. The ending line 'Real friends don't need a group chat' must feel empowering. Focus on the digital age loneliness and the strength to walk away."
  },

  what_could_have_been: {
    id: "what_could_have_been",
    title: "What Could Have Been",
    emotion_arc: {
      start: "nostalgia",
      middle: "longing",
      climax: "acceptance",
      end: "bittersweet peace"
    },
    bgm_tags: ["nostalgic", "acoustic", "melancholic", "reflective"],
    hook: {
      timing: "0-2s",
      must_show: "@image_1 looking at an old photo, lost in memory",
      emotion: "wistful longing"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 in present day", "holding old photo", "moment of remembering"],
        emotion_beat: "the trigger",
        visual_style: "muted colors, contemplative"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["flashback", "younger @image_1", "the moment that mattered"],
        emotion_beat: "the memory",
        visual_style: "warm, saturated, idealized"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["alternate reality", "@image_1 in different life", "what could have been"],
        emotion_beat: "the fantasy",
        visual_style: "dreamlike, soft focus, golden"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 in present", "putting photo away", "moving forward"],
        emotion_beat: "letting go",
        visual_style: "clear, present, accepting"
      }
    ],
    ending: {
      killer_line: "Some paths are beautiful because we didn't take them.",
      final_emotion: "peaceful acceptance",
      visual_requirement: "@image_1 walking forward, photo left behind, at peace"
    },
    director_prompt: "This is about the roads not taken and finding peace with choices. The hook MUST show the old photo triggering memory in the first 2 seconds. Build the longing through idealized flashbacks. The ending line 'Some paths are beautiful because we didn't take them' must bring closure. Focus on the beauty of what-ifs without regret."
  },

  breaking_news: {
    id: "breaking_news",
    title: "Your friend betrayed you (and you saw it happen)",
    emotion_arc: {
      start: "trust",
      middle: "suspicion",
      climax: "caught red-handed",
      end: "cold justice"
    },
    bgm_tags: ["dramatic", "news", "tension", "reveal"],
    hook: {
      timing: "0-2s",
      must_show: "Breaking news banner: '@image_1 CAUGHT ON CAMERA'",
      emotion: "public exposure"
    },
    shots: [
      {
        shot_number: 1,
        duration: "3s",
        must_have: ["@image_1 acting normal", "fake smile", "hiding something"],
        emotion_beat: "the facade",
        visual_style: "bright, public, performative"
      },
      {
        shot_number: 2,
        duration: "4s",
        must_have: ["security camera footage", "@image_1 doing the betrayal", "timestamp"],
        emotion_beat: "the evidence",
        visual_style: "grainy CCTV, black and white, damning"
      },
      {
        shot_number: 3,
        duration: "4s",
        must_have: ["@image_1 realizing they're caught", "panic", "nowhere to hide"],
        emotion_beat: "the exposure",
        visual_style: "harsh light, close-up, trapped"
      },
      {
        shot_number: 4,
        duration: "4s",
        must_have: ["@image_1 alone", "reputation destroyed", "consequences"],
        emotion_beat: "the fallout",
        visual_style: "cold, isolated, deserved"
      }
    ],
    ending: {
      killer_line: "The truth always finds a camera.",
      final_emotion: "justice served",
      visual_requirement: "@image_1 walking away in shame, everyone watching"
    },
    director_prompt: "This is about betrayal exposed and public consequences. The hook MUST show the breaking news banner in the first 2 seconds. Build the exposure through security footage and witnesses. The ending line 'The truth always finds a camera' must feel like karma. Focus on the modern surveillance age and nowhere to hide. This is meant to be shared as a prank - make it dramatic but playful."
  }
}

/**
 * Template ID aliases - maps frontend template IDs to blueprint IDs
 */
const TEMPLATE_ALIASES: Record<string, string> = {
  'phone_3am': 'she_didnt_choose_you',
  'future_warning': 'future_you',
  'group_chat': 'last_person',
  'dog_last_words': 'lost_someone',
  'what_could_have_been': 'parallel_universe',
}

/**
 * Get blueprint for a template ID
 * Handles alias mapping from frontend template IDs to blueprint IDs
 */
export function getTemplateBlueprint(templateId: string): TemplateBlueprint | null {
  const blueprintId = TEMPLATE_ALIASES[templateId] || templateId
  console.log('[DEBUG] blueprint lookup:', { input: templateId, resolved: blueprintId, found: !!TEMPLATE_BLUEPRINTS[blueprintId] })
  return TEMPLATE_BLUEPRINTS[blueprintId] || null
}

/**
 * Validate that a director's output follows the blueprint
 */
export function validateAgainstBlueprint(
  directorOutput: any,
  blueprint: TemplateBlueprint
): { valid: boolean; violations: string[] } {
  const violations: string[] = []

  // Check shot count
  if (directorOutput.shots?.length !== blueprint.shots.length) {
    violations.push(`Expected ${blueprint.shots.length} shots, got ${directorOutput.shots?.length || 0}`)
  }

  // Check hook timing
  if (!directorOutput.shots?.[0]?.description?.toLowerCase().includes(blueprint.hook.must_show.toLowerCase().substring(0, 20))) {
    violations.push('Hook does not match blueprint requirement in first shot')
  }

  // Check ending line presence
  const lastShot = directorOutput.shots?.[directorOutput.shots.length - 1]
  if (!lastShot?.dialogue?.includes(blueprint.ending.killer_line)) {
    violations.push(`Ending killer line "${blueprint.ending.killer_line}" not found`)
  }

  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * HOOK SUBTITLES
 * 
 * Pre-written emotional subtitles for each template's hook video.
 * Designed for zero-delay emotional impact - text appears instantly.
 * 
 * Format: { time: seconds, text: string }
 * - time: exact second when subtitle appears
 * - text: short, punchy line (max 8 words)
 * 
 * Hook videos are 5-8 seconds, so subtitles cut off around 6s
 * to create cliffhanger effect.
 */
export interface HookSubtitle {
  time: number
  text: string
}

export const HOOK_SUBTITLES: Record<string, HookSubtitle[]> = {
  she_didnt_choose_you: [
    { time: 0.0, text: "She unlocked your phone." },
    { time: 1.5, text: "3:17 AM." },
    { time: 3.0, text: "You were sleeping." },
    { time: 5.0, text: "She saw everything." }
  ],
  lost_someone: [
    { time: 0.0, text: "Your dog just said your name." },
    { time: 1.5, text: "Out loud." },
    { time: 3.0, text: "Right before it died." },
    { time: 5.0, text: "It had something to tell you." }
  ],
  dog_last_words: [
    { time: 0.0, text: "Your dog just said your name." },
    { time: 1.5, text: "Out loud." },
    { time: 3.0, text: "Right before it died." },
    { time: 5.0, text: "It had something to tell you." }
  ],
  last_person: [
    { time: 0.0, text: "They kept talking after you left." },
    { time: 1.5, text: "About you." },
    { time: 3.0, text: "Not what you think." },
    { time: 5.0, text: "You shouldn't read this." }
  ],
  future_you: [
    { time: 0.0, text: "You don't have much time." },
    { time: 1.5, text: "I'm you." },
    { time: 3.0, text: "From the future." },
    { time: 5.0, text: "You already made the wrong choice." }
  ],
  future_warning: [
    { time: 0.0, text: "You don't have much time." },
    { time: 1.5, text: "I'm you." },
    { time: 3.0, text: "From the future." },
    { time: 5.0, text: "You already made the wrong choice." }
  ],
  friend_betrayal: [
    { time: 0.0, text: "He told them everything." },
    { time: 1.5, text: "Your secret." },
    { time: 3.0, text: "He was smiling." },
    { time: 5.0, text: "And you trusted him." }
  ],
  what_could_have_been: [
    { time: 0.0, text: "This was your life." },
    { time: 1.5, text: "If you said yes." },
    { time: 3.0, text: "You didn't." },
    { time: 5.0, text: "Look at what you lost." }
  ],
  breaking_news: [
    { time: 0.0, text: "That's your friend." },
    { time: 1.5, text: "On the news." },
    { time: 3.0, text: "For the wrong reason." },
    { time: 5.0, text: "They're saying his name." }
  ],
  phone_3am: [
    { time: 0.0, text: "She unlocked your phone." },
    { time: 1.5, text: "3:17 AM." },
    { time: 3.0, text: "You were sleeping." },
    { time: 5.0, text: "She saw everything." }
  ],
  group_chat: [
    { time: 0.0, text: "They kept talking after you left." },
    { time: 1.5, text: "About you." },
    { time: 3.0, text: "Not what you think." },
    { time: 5.0, text: "You shouldn't read this." }
  ],
  parallel_universe: [
    { time: 0.0, text: "This is you." },
    { time: 1.5, text: "In another universe." },
    { time: 3.0, text: "You made different choices." },
    { time: 5.0, text: "Look at what happened." }
  ]
}
