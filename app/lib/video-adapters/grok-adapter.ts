/**
 * Grok Video Adapter
 * 
 * Implements VideoAdapter for xAI's Grok video generation API
 */

import { VideoAdapter, DirectorIntent, VideoAdapterConfig } from './types'

export class GrokAdapter implements VideoAdapter {
  provider: "grok" = "grok"
  private config: VideoAdapterConfig

  constructor(config: VideoAdapterConfig) {
    this.config = config
  }

  supports(intent: DirectorIntent): boolean {
    // Grok supports:
    // - 9:16 aspect ratio
    // - Up to 15 seconds
    // - Multi-shot generation
    return (
      intent.aspect_ratio === "9:16" &&
      intent.duration_seconds <= 15
    )
  }

  estimateCost(intent: DirectorIntent): number {
    // Grok video pricing: estimated $0.40 per 15s video
    const baseCost = 0.40
    const durationMultiplier = intent.duration_seconds / 15
    return baseCost * durationMultiplier
  }

  async createJob(intent: DirectorIntent, images: string[]): Promise<{
    provider_job_id: string
    status: "queued" | "processing"
  }> {
    // Convert DirectorIntent to Grok API format
    const grokPrompt = this.buildGrokPrompt(intent)
    
    const grokBody = {
      model: "grok-video-1",
      prompt: grokPrompt,
      aspect_ratio: intent.aspect_ratio,
      duration: intent.duration_seconds,
      language: intent.language,
      reference_images: images.map((url, index) => ({
        url,
        weight: index === 0 ? 1.0 : 0.7 // Primary image has higher weight
      })),
      shots: intent.shots.map(shot => ({
        duration: shot.duration,
        emotion: shot.emotion,
        framing: shot.framing,
        motion: shot.motion,
        reference_image_index: shot.reference_image_index
      }))
    }

    const response = await fetch('https://api.x.ai/v1/video/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(grokBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Grok API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const jobId = data?.id

    if (!jobId) {
      throw new Error('Grok job creation failed: ' + JSON.stringify(data).slice(0, 200))
    }

    return {
      provider_job_id: jobId,
      status: "queued"
    }
  }

  async getJobStatus(jobId: string): Promise<{
    status: "queued" | "processing" | "succeeded" | "failed"
    video_url?: string
    error?: string
  }> {
    const response = await fetch(`https://api.x.ai/v1/video/generations/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Grok status check error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const status = data?.status
    const videoUrl = data?.output?.video_url || data?.video_url

    // Map Grok status to standard status
    const statusMap: Record<string, "queued" | "processing" | "succeeded" | "failed"> = {
      'queued': 'queued',
      'pending': 'queued',
      'processing': 'processing',
      'in_progress': 'processing',
      'completed': 'succeeded',
      'succeeded': 'succeeded',
      'failed': 'failed',
      'error': 'failed'
    }

    return {
      status: statusMap[status] || 'processing',
      video_url: videoUrl,
      error: data?.error || data?.error_message
    }
  }

  private buildGrokPrompt(intent: DirectorIntent): string {
    // Build comprehensive prompt from DirectorIntent
    const shotDescriptions = intent.shots.map((shot, index) => {
      return `Shot ${index + 1} (${shot.duration}s): ${shot.framing} of character showing ${shot.emotion}, ${shot.motion}, ${shot.action_completed_state}`
    }).join('. ')

    return `Cinematic ${intent.aspect_ratio} video, ${intent.duration_seconds} seconds. Story: ${intent.story_category}. ${shotDescriptions}. Ending: "${intent.ending_line}". Style: emotional, cinematic lighting, smooth transitions.`
  }
}

/**
 * Factory function to create GrokAdapter with environment config
 */
export function createGrokAdapter(): GrokAdapter {
  const apiKey = process.env.GROK_API_KEY
  
  if (!apiKey) {
    throw new Error('GROK_API_KEY environment variable is not set')
  }

  return new GrokAdapter({
    apiKey
  })
}
