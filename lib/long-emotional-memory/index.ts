export interface EmotionalMemory {
  projectId: string
  characters: {
    name: string
    flaw: string
    hiddenDesire: string
    relationshipWound: string
  }[]
  visualSymbols: {
    symbol: string
    firstAppearance: number
    meaning: string
    callbacks: number[]
  }[]
  unspokenThings: {
    character: string
    whatTheyWantToSay: string
    whyTheyDont: string
    shotToReveal: number
  }[]
  emotionalDebt: {
    description: string
    owedBy: string
    repaidInShot: number | null
  }[]
  pendingCallbacks: {
    element: string
    introducedInShot: number
    resolvedInShot: number | null
  }[]
}

export function createMemory(projectId: string): EmotionalMemory {
  return {
    projectId,
    characters: [],
    visualSymbols: [],
    unspokenThings: [],
    emotionalDebt: [],
    pendingCallbacks: []
  }
}

export function addVisualSymbol(
  memory: EmotionalMemory,
  symbol: string,
  firstShot: number,
  meaning: string
): EmotionalMemory {
  return {
    ...memory,
    visualSymbols: [
      ...memory.visualSymbols,
      { symbol, firstAppearance: firstShot, meaning, callbacks: [] }
    ]
  }
}

export function addCallback(
  memory: EmotionalMemory,
  symbol: string,
  callbackShot: number
): EmotionalMemory {
  return {
    ...memory,
    visualSymbols: memory.visualSymbols.map(s =>
      s.symbol === symbol
        ? { ...s, callbacks: [...s.callbacks, callbackShot] }
        : s
    )
  }
}

export function getUnresolvedCallbacks(memory: EmotionalMemory) {
  return memory.pendingCallbacks.filter(c => c.resolvedInShot === null)
}
