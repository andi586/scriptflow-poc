/**
 * VideoAdapter Protocol
 * 
 * Standard interface for video generation providers (Kling, Grok, Seedance, Veo)
 * Ensures consistent DirectorIntent → Video pipeline across all providers
 */

export interface DirectorIntent {
  version: "2.0"
  story_category: string
  archetype: string
  blueprint_id: string
  duration_seconds: 15
  aspect_ratio: "9:16"
  language: "en"
  shots: DirectorShot[]
  bgm_archetype: string
  ending_line: string
}

export interface DirectorShot {
  shot_id: string
  duration: number
  emotion: string
  framing: "extreme_close_up" | "close_up" | "medium_close_up"
  motion: string
  face_priority: number
  action_completed_state: string
  reference_image_index: number
  forbidden: string[]
}

export interface VideoAdapter {
  provider: "kling" | "grok" | "seedance" | "veo"
  
  /**
   * Check if this adapter supports the given DirectorIntent
   */
  supports(intent: DirectorIntent): boolean
  
  /**
   * Estimate cost in USD for generating this video
   */
  estimateCost(intent: DirectorIntent): number
  
  /**
   * Create a video generation job
   */
  createJob(intent: DirectorIntent, images: string[]): Promise<{
    provider_job_id: string
    status: "queued" | "processing"
  }>
  
  /**
   * Get status of a video generation job
   */
  getJobStatus(jobId: string): Promise<{
    status: "queued" | "processing" | "succeeded" | "failed"
    video_url?: string
    error?: string
  }>
}

export interface VideoAdapterConfig {
  apiKey: string
  webhookUrl?: string
  maxRetries?: number
  timeoutMs?: number
}
