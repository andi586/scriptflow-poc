export const TEMPLATES = [
  {
    id: 'sixty_seconds_left',
    name: '60 Seconds Left',
    emoji: '💀',
    duration: '30s',
    shots: 6,
    archetype: 'panic',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Trainyard_Countdown-09711e21-388c-4700-b84b-1f2db4ee0aa2.mp3',
    requiredPhotos: [{ slot: 'you', label: 'You', required: true }],
    dialogue: [
      "Wait… what is this?",
      "You have 60 seconds left.",
      "This isn't funny.",
      "…59… 58…",
      "Oh my god—"
    ],
    shotStructure: [
      { shot: 1, duration: 3, type: 'scene', description: 'Normal day, calm environment' },
      { shot: 2, duration: 5, type: 'scene', description: 'Phone screen shows strange message' },
      { shot: 3, duration: 5, type: 'face', description: 'Disbelief, checking phone again' },
      { shot: 4, duration: 5, type: 'face', description: 'Panic rising, eyes wide' },
      { shot: 5, duration: 6, type: 'scene', description: 'Countdown visible, environment darkening' },
      { shot: 6, duration: 6, type: 'face', description: 'Pure terror - CUT TO BLACK' }
    ],
    emotionCurve: [1,3,5,7,9,10],
    shareText: "I only had 60 seconds left… 😳\n\n👉 Try yours"
  },
  {
    id: 'the_betrayal',
    name: 'The Betrayal',
    emoji: '🗡️',
    duration: '30s',
    shots: 6,
    archetype: 'betrayal',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Stringed_Oath_A.mp3',
    requiredPhotos: [
      { slot: 'you', label: 'You', required: true },
      { slot: 'them', label: 'Them', required: true }
    ],
    dialogue: [
      "I trusted you.",
      "More than anyone.",
      "Why are you lying?",
      "You knew… didn't you?",
      "Say it."
    ],
    shotStructure: [
      { shot: 1, duration: 4, type: 'scene', description: 'Two people together, trust and warmth' },
      { shot: 2, duration: 5, type: 'face', description: 'Close up - genuine smile, safety' },
      { shot: 3, duration: 5, type: 'scene', description: 'Suspicious detail noticed' },
      { shot: 4, duration: 5, type: 'face', description: 'Doubt creeping in' },
      { shot: 5, duration: 5, type: 'face', description: 'Confrontation begins' },
      { shot: 6, duration: 6, type: 'face', description: 'Raw emotion - CUT TO BLACK' }
    ],
    emotionCurve: [2,3,5,7,8,10],
    shareText: "I never saw it coming… 🗡️\n\n👉 Try yours"
  },
  {
    id: 'you_found_something',
    name: 'You Found Something',
    emoji: '😱',
    duration: '30s',
    shots: 5,
    archetype: 'secret_revealed',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Snowdrift_Loop-33fedaab-51b4-44d6-9fd3-b05079c609dc.mp3',
    requiredPhotos: [{ slot: 'you', label: 'You', required: true }],
    dialogue: [
      "This wasn't here before.",
      "Who put this here?",
      "Wait…",
      "Someone's watching me.",
      "…who's there?"
    ],
    shotStructure: [
      { shot: 1, duration: 4, type: 'scene', description: 'Quiet normal environment' },
      { shot: 2, duration: 6, type: 'scene', description: 'Something out of place discovered' },
      { shot: 3, duration: 6, type: 'face', description: 'Zoom in on strange object' },
      { shot: 4, duration: 7, type: 'face', description: 'Fear rising, looking around' },
      { shot: 5, duration: 7, type: 'scene', description: 'Shadow or presence - CUT TO BLACK' }
    ],
    emotionCurve: [1,3,5,8,10],
    shareText: "Something wasn't right… 😱\n\n👉 Try yours"
  },
  {
    id: 'become_someone_else',
    name: 'Become Someone Else',
    emoji: '🪞',
    duration: '60s',
    shots: 8,
    archetype: 'self_discovery',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Piano_Pulse_Awakening-5cfd9586-4ae3-4659-a0a6-239536f97c45.mp3',
    requiredPhotos: [{ slot: 'you', label: 'You', required: true }],
    dialogue: [
      "That's not me.",
      "Why do I look like this?",
      "No… no…",
      "What's happening?",
      "This isn't real."
    ],
    shotStructure: [
      { shot: 1, duration: 5, type: 'scene', description: 'Normal morning routine' },
      { shot: 2, duration: 7, type: 'face', description: 'Mirror reflection looks wrong' },
      { shot: 3, duration: 7, type: 'face', description: 'Does not recognize self' },
      { shot: 4, duration: 8, type: 'face', description: 'Panic, touching face' },
      { shot: 5, duration: 8, type: 'scene', description: 'Trying to confirm reality' },
      { shot: 6, duration: 8, type: 'face', description: 'Deeper wrongness discovered' },
      { shot: 7, duration: 8, type: 'face', description: 'Complete breakdown' },
      { shot: 8, duration: 9, type: 'scene', description: 'Twist ending - CUT TO BLACK' }
    ],
    emotionCurve: [2,3,5,7,8,9,9,10],
    shareText: "I looked in the mirror and… 🪞\n\n👉 Try yours"
  },
  {
    id: 'power_shift',
    name: 'Power Shift',
    emoji: '👑',
    duration: '60s',
    shots: 8,
    archetype: 'comeback_story',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Triumphant_No-Vocal-0249cc79-3054-483b-8a4f-8c211e555672.mp3',
    requiredPhotos: [{ slot: 'you', label: 'You', required: true }],
    dialogue: [
      "You think I'm weak?",
      "You have no idea.",
      "Watch me.",
      "Everything changes now.",
      "You answer to me."
    ],
    shotStructure: [
      { shot: 1, duration: 5, type: 'face', description: 'Being dominated, looking down' },
      { shot: 2, duration: 6, type: 'face', description: 'Being humiliated, silent' },
      { shot: 3, duration: 7, type: 'face', description: 'Something shifts inside' },
      { shot: 4, duration: 8, type: 'face', description: 'Eyes change, awakening' },
      { shot: 5, duration: 8, type: 'scene', description: 'Fighting back, counterattack' },
      { shot: 6, duration: 8, type: 'scene', description: 'Taking control of situation' },
      { shot: 7, duration: 9, type: 'face', description: 'Declaring power, standing tall' },
      { shot: 8, duration: 9, type: 'scene', description: 'Aftermath, new order established' }
    ],
    emotionCurve: [2,3,4,6,8,9,10,8],
    shareText: "They had no idea what I was capable of… 👑\n\n👉 Try yours"
  },
  {
    id: 'pet_saved_you',
    name: 'Pet Saved You',
    emoji: '🐾',
    duration: '60s',
    shots: 7,
    archetype: 'pet_daily',
    bgmUrl: 'https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/music/My_Workspace-Ukulele_Cat_Pants-ac740d3e-475d-46ff-aa30-b7d02ffdaa7f.mp3',
    requiredPhotos: [
      { slot: 'you', label: 'You', required: true },
      { slot: 'pet', label: 'Pet', required: true }
    ],
    dialogue: [
      "What's wrong with you?",
      "Why are you acting like this?",
      "Wait—",
      "Oh my god!",
      "You saved me…"
    ],
    shotStructure: [
      { shot: 1, duration: 6, type: 'scene', description: 'Normal day with pet' },
      { shot: 2, duration: 7, type: 'scene', description: 'Pet acting strangely, alert' },
      { shot: 3, duration: 8, type: 'face', description: 'Owner confused, ignoring pet' },
      { shot: 4, duration: 8, type: 'scene', description: 'Danger approaching unseen' },
      { shot: 5, duration: 9, type: 'scene', description: 'Pet takes action' },
      { shot: 6, duration: 9, type: 'scene', description: 'Crisis moment explodes' },
      { shot: 7, duration: 13, type: 'face', description: 'Saved - emotional realization' }
    ],
    emotionCurve: [2,3,4,6,8,9,10],
    shareText: "My pet knew something I didn't… 🐾\n\n👉 Try yours"
  }
]

export function getTemplate(id: string) {
  return TEMPLATES.find(t => t.id === id) || null
}
