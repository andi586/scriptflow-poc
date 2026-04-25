export const HOOK_TEMPLATES = [
  {
    id: 'final_24_hours',
    name: 'Final 24 Hours',
    archetype: 'panic',
    colorGrade: 'cold',
    lines: [
      'You have 24 hours left.',
      'And you don\'t know why.',
      'Watch how it ends.'
    ],
    timing: [
      { text: 'You have 24 hours left.', startTime: 1, endTime: 3 },
      { text: 'And you don\'t know why.', startTime: 4, endTime: 7 },
      { text: 'Watch how it ends.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'the_betrayal',
    name: 'The One Who Betrayed You',
    archetype: 'betrayal',
    colorGrade: 'dark',
    lines: [
      'They smiled at you yesterday.',
      'They ruined you today.',
      'Now watch your revenge.'
    ],
    timing: [
      { text: 'They smiled at you yesterday.', startTime: 1, endTime: 3 },
      { text: 'They ruined you today.', startTime: 4, endTime: 7 },
      { text: 'Now watch your revenge.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'something_watching',
    name: 'Something Is Watching You',
    archetype: 'secret_revealed',
    colorGrade: 'cold',
    lines: [
      'You felt it last night.',
      'It followed you home.',
      'It\'s closer than you think.'
    ],
    timing: [
      { text: 'You felt it last night.', startTime: 1, endTime: 3 },
      { text: 'It followed you home.', startTime: 4, endTime: 7 },
      { text: 'It\'s closer than you think.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'never_you',
    name: 'You Were Never You',
    archetype: 'self_discovery',
    colorGrade: 'cinematic',
    lines: [
      'This isn\'t your life.',
      'You were placed here.',
      'Find out who you are.'
    ],
    timing: [
      { text: 'This isn\'t your life.', startTime: 1, endTime: 3 },
      { text: 'You were placed here.', startTime: 4, endTime: 7 },
      { text: 'Find out who you are.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'power_shift',
    name: 'They Took Everything',
    archetype: 'comeback_story',
    colorGrade: 'epic',
    lines: [
      'They took everything from you.',
      'They thought you\'d break.',
      'Now watch you rise.'
    ],
    timing: [
      { text: 'They took everything from you.', startTime: 1, endTime: 3 },
      { text: 'They thought you\'d break.', startTime: 4, endTime: 7 },
      { text: 'Now watch you rise.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'pet_saved_you',
    name: 'He Chose You',
    archetype: 'pet_daily',
    colorGrade: 'warm',
    lines: [
      'He found you first.',
      'He never left your side.',
      'He saved your life.'
    ],
    timing: [
      { text: 'He found you first.', startTime: 1, endTime: 3 },
      { text: 'He never left your side.', startTime: 4, endTime: 7 },
      { text: 'He saved your life.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'future_calling',
    name: 'Your Future Is Calling',
    archetype: 'hope',
    colorGrade: 'cinematic',
    lines: [
      'You heard the voice.',
      'It knew your name.',
      'It knows your future.'
    ],
    timing: [
      { text: 'You heard the voice.', startTime: 1, endTime: 3 },
      { text: 'It knew your name.', startTime: 4, endTime: 7 },
      { text: 'It knows your future.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'everyone_knows',
    name: 'Everyone Knows You',
    archetype: 'tension',
    colorGrade: 'cold',
    lines: [
      'They all recognize you.',
      'But you don\'t know them.',
      'Something is very wrong.'
    ],
    timing: [
      { text: 'They all recognize you.', startTime: 1, endTime: 3 },
      { text: 'But you don\'t know them.', startTime: 4, endTime: 7 },
      { text: 'Something is very wrong.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'died_once',
    name: 'You Already Died Once',
    archetype: 'mystery',
    colorGrade: 'dark',
    lines: [
      'You died last night.',
      'But you woke up.',
      'This time is different.'
    ],
    timing: [
      { text: 'You died last night.', startTime: 1, endTime: 3 },
      { text: 'But you woke up.', startTime: 4, endTime: 7 },
      { text: 'This time is different.', startTime: 10, endTime: 14 }
    ]
  },
  {
    id: 'your_choice',
    name: 'This Was Your Choice',
    archetype: 'late_regret',
    colorGrade: 'dramatic',
    lines: [
      'You made the decision.',
      'You ignored the warning.',
      'Now face the consequence.'
    ],
    timing: [
      { text: 'You made the decision.', startTime: 1, endTime: 3 },
      { text: 'You ignored the warning.', startTime: 4, endTime: 7 },
      { text: 'Now face the consequence.', startTime: 10, endTime: 14 }
    ]
  }
]

export function getHookTemplate(archetype: string) {
  return HOOK_TEMPLATES.find(t => t.archetype === archetype) || HOOK_TEMPLATES[0]
}
