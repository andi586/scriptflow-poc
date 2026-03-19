export type ProjectStatus =
  | "draft"
  | "analyzing"
  | "ready"
  | "generating"
  | "completed"
  | "archived";

export type BeatStatus =
  | "pending"
  | "generating"
  | "reviewing"
  | "approved"
  | "rejected"
  | "failed";

export type TaskStatus =
  | "queued"
  | "submitted"
  | "processing"
  | "completed"
  | "failed"
  | "retrying";

export type GenerationProvider = "kling" | "runway" | "veo" | "luma" | "pika";

export type CharacterRole =
  | "protagonist_female"
  | "protagonist_male"
  | "supporting"
  | "background";

export type SceneGrade = "A" | "B" | "C";
export type AspectRatio = "9:16" | "16:9" | "1:1";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  aspect_ratio: AspectRatio;
  resolution: string;
  default_provider: GenerationProvider;
  video_duration_sec: number;
  total_credits_used: number;
  credits_budget: number | null;
  script_raw: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface StoryMemory {
  id: string;
  project_id: string;
  narrative_arc: string;
  tone: string;
  visual_style: string;
  foreshadowing_map: ForeshadowingItem[];
  core_visual_symbols: string[];
  continuity_notes: string;
  raw_analysis: Record<string, unknown>;
  model_used: string;
  parsed_at: string;
}

export interface ForeshadowingItem {
  symbol: string;
  planted_at_beat: number;
  reinforced_at_beats: number[];
  resolved_at_beat: number;
  significance: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role: CharacterRole;
  appearance: string;
  personality: string;
  language_fingerprint: string;
  reference_image_url: string;
  reference_image_path: string;
  processed_image_url: string | null;
  appears_in_beats: number[];
  created_at: string;
  updated_at: string;
}

export interface Beat {
  id: string;
  project_id: string;
  beat_number: number;
  description: string;
  emotion: string;
  scene_grade: SceneGrade | null;
  prompt: string | null;
  negative_prompt: string | null;
  character_ids: string[];
  status: BeatStatus;
  consistency_score: number | null;
  narrative_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationRequest {
  prompt: string;
  negative_prompt?: string;
  duration_sec: number;
  aspect_ratio: AspectRatio;
  resolution: string;
  reference_images?: string[];
  style_strength?: number;
}

export interface CostEstimate {
  credits: number;
  usd: number;
  breakdown: string;
}

export interface ConsistencyJudgment {
  consistency_score: number;
  narrative_score: number;
  passed: boolean;
  reasoning: string;
  issues: string[];
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

