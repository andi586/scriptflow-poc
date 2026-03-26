export interface Direction {
  title: string;
  summary: string;
  style: string;
}

export interface DevelopExploreResponse {
  coreConflict: string;
  theme: string;
  emotionalHook: string;
  directions: Direction[];
}

export interface DevelopExpandResponse {
  title: string;
  logline: string;
  world: string;
  tone: string;
  coreConflict: string;
  characterDynamics: string;
}

export interface ScriptCharacter {
  name: string;
  role: "protagonist" | "antagonist" | "supporting";
  personality: string;
  goal: string;
}

export interface ScriptEpisode {
  episode: number;
  summary: string;
}

export interface StructureResponse {
  threeAct: {
    setup: string;
    confrontation: string;
    resolution: string;
  };
  characters: ScriptCharacter[];
  episodes: {
    three: ScriptEpisode[];
    six: ScriptEpisode[];
    nine: ScriptEpisode[];
  };
  foreshadowing: string[];
}

export type ScriptStep = 1 | 2 | 3 | 4 | 5;

export interface ScriptFlowState {
  step: ScriptStep;
  idea: string;
  genre: string;
  episodeCount: 3 | 6 | 9;
  exploreResult: DevelopExploreResponse | null;
  selectedDirection: Direction | null;
  expandResult: DevelopExpandResponse | null;
  structureResult: StructureResponse | null;
}
