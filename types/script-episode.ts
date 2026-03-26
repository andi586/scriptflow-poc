export type EpisodeRole = "protagonist" | "antagonist" | "supporting";

export interface ScriptCharacter {
  name: string;
  role: EpisodeRole;
  personality: string;
  goal: string;
}

export interface ThreeActStructure {
  setup: string;
  confrontation: string;
  resolution: string;
}

export interface SeasonSpec {
  title: string;
  logline: string;
  world: string;
  tone: string;
  coreConflict: string;
  totalEpisodes: 3 | 6 | 9;
  threeAct: ThreeActStructure;
  characters: ScriptCharacter[];
  foreshadowing: string[];
}

export interface DialogueLine {
  character: string;
  emotion: string;
  text: string;
}

export interface EpisodeScene {
  sceneNumber: number;
  sceneTitle: string;
  location: string;
  timeOfDay: string;
  sceneDescription: string;
  emotionalBeat: string;
  visualPrompt: string;
  dialogue: DialogueLine[];
}

export interface EpisodeScript {
  episodeNumber: number;
  title: string;
  logline: string;
  summary: string;
  scenes: EpisodeScene[];
}

export interface GenerateEpisodeRequest {
  projectId: string;
  episodeNumber: number;
  rewrite?: boolean;
  rewriteInstruction?: string;
  seasonSpec: SeasonSpec;
}

export interface GenerateEpisodeResponse {
  success: true;
  episode: EpisodeScript;
  persisted: {
    projectId: string;
    episodeNumber: number;
    version: number;
    status: string;
  };
}
