/**
 * ScriptFlow · AI Emotion Director — emotion_patterns types
 *
 * Abstraction layer for viral hooks, golden lines, comment memes, reversals,
 * moral misalignment, and high-retention emotional mechanisms.
 *
 * @see supabase/migrations/20260519_create_emotion_patterns.sql
 */

/** Pattern families aligned with Emotion Director catalog */
export type EmotionPatternCategory =
  | "viral_hook"
  | "golden_line"
  | "comment_reply"
  | "dark_humor"
  | "dark_humor_reversal"
  | "counter_expectation"
  | "emotion_reversal"
  | "moral_misalignment"
  | "retention_mechanic"
  | (string & {});

/** How the pattern entered the library */
export type EmotionPatternSourceType =
  | "comment"
  | "hook"
  | "script"
  | "manual"
  | "benchmark"
  | "import"
  | (string & {});

/** Reusable viral / cognitive mechanism tags */
export type ViralMechanismTag =
  | "expectation_collapse"
  | "moral_reversal"
  | "absurd_humor"
  | "identity_flip"
  | "status_inversion"
  | "delayed_punchline"
  | "empathy_hijack"
  | (string & {});

/** Full row as returned from Supabase */
export interface EmotionPatternRow {
  id: string;
  pattern_name: string;
  category: string;
  setup_structure: string | null;
  reversal_structure: string | null;
  emotion_trigger: string | null;
  retention_trigger: string | null;
  viral_mechanism: string[];
  cognitive_pattern: string | null;
  example_text: string | null;
  example_analysis: string | null;
  platform: string | null;
  language: string;
  universality_score: number;
  shareability_score: number;
  watchtime_score: number;
  tags: string[];
  source_type: string | null;
  created_at: string;
}

/** Insert payload (id and timestamps optional) */
export interface EmotionPatternInsert {
  id?: string;
  pattern_name: string;
  category: string;
  setup_structure?: string | null;
  reversal_structure?: string | null;
  emotion_trigger?: string | null;
  retention_trigger?: string | null;
  viral_mechanism?: string[];
  cognitive_pattern?: string | null;
  example_text?: string | null;
  example_analysis?: string | null;
  platform?: string | null;
  language?: string;
  universality_score?: number;
  shareability_score?: number;
  watchtime_score?: number;
  tags?: string[];
  source_type?: string | null;
  created_at?: string;
}

/** Partial update */
export interface EmotionPatternUpdate {
  pattern_name?: string;
  category?: string;
  setup_structure?: string | null;
  reversal_structure?: string | null;
  emotion_trigger?: string | null;
  retention_trigger?: string | null;
  viral_mechanism?: string[];
  cognitive_pattern?: string | null;
  example_text?: string | null;
  example_analysis?: string | null;
  platform?: string | null;
  language?: string;
  universality_score?: number;
  shareability_score?: number;
  watchtime_score?: number;
  tags?: string[];
  source_type?: string | null;
}

/** Director-facing subset for prompt injection */
export interface EmotionPatternBrief {
  pattern_name: string;
  category: string;
  setup_structure: string | null;
  reversal_structure: string | null;
  emotion_trigger: string | null;
  retention_trigger: string | null;
  viral_mechanism: string[];
  cognitive_pattern: string | null;
  example_text: string | null;
  universality_score: number;
  tags: string[];
}

export function toEmotionPatternBrief(row: EmotionPatternRow): EmotionPatternBrief {
  return {
    pattern_name: row.pattern_name,
    category: row.category,
    setup_structure: row.setup_structure,
    reversal_structure: row.reversal_structure,
    emotion_trigger: row.emotion_trigger,
    retention_trigger: row.retention_trigger,
    viral_mechanism: row.viral_mechanism,
    cognitive_pattern: row.cognitive_pattern,
    example_text: row.example_text,
    universality_score: row.universality_score,
    tags: row.tags,
  };
}

/** Supabase Database helper shape (for generated client wiring) */
export interface DatabaseEmotionPatterns {
  public: {
    Tables: {
      emotion_patterns: {
        Row: EmotionPatternRow;
        Insert: EmotionPatternInsert;
        Update: EmotionPatternUpdate;
      };
    };
  };
}
