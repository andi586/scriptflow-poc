/**
 * Kling Video Adapter
 * 
 * Wraps Kling 3.0 Omni API into VideoAdapter interface
 */

import { VideoAdapter, DirectorIntent, VideoAdapterConfig } from './types'

export class KlingAdapter implements VideoAdapter {
  provider: "kling" = "kling"
  private config: VideoAdapterConfig

  constructor(config: VideoAdapterConfig) {
    this.config = config
  }

  supports(intent: DirectorIntent): boolean {
    // Kling supports:
    // - 9:16 aspect ratio
    // - Up to 15 seconds
    // - Multi-shot with up to 7 images
    return (
      intent.aspect_ratio === "9:16" &&
      intent.duration_seconds <= 15 &&
      intent.shots.length <= 10
    )
  }

  estimateCost(intent: DirectorIntent): number {
    // Kling 3.0 Omni pricing: ~$0.50 per 15s video
    const baseCost = 0.50
    const shotMultiplier = Math.min(intent.shots.length / 6, 1.5)
    return baseCost * shotMultiplier
  }

  async createJob(intent: DirectorIntent, images: string[]): Promise<{
    provider_job_id: string
    status: "queued" | "processing"
  }> {
    // Convert DirectorIntent shots to Kling multi_shots format
    const multiShots = intent.shots.map((shot, index) => ({
      prompt: this.buildKlingPrompt(shot, intent),
      duration: shot.duration
    }))

    // Limit images to 7 (Kling API limit)
    const klingImages = images.slice(0, 7)

    const klingBody = {
      model: 'kling',
      task_type: 'omni_video_generation',
      input: {
        version: '3.0',
        resolution: '720p',
        aspect_ratio: intent.aspect_ratio,
        enable_audio: true,
        language: intent.language,
        images: klingImages,
        multi_shots: multiShots
      },
      config: {
        service_mode: 'public',
        webhook_config: {
          endpoint: this.config.webhookUrl || '',
          secret: ''
        }
      }
    }

    const response = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(klingBody)
    })

    const data = await response.json()
    const taskId = data?.data?.task_id

    if (!taskId) {
      throw new Error('Kling task creation failed: ' + JSON.stringify(data).slice(0, 200))
    }

    return {
      provider_job_id: taskId,
      status: "queued"
    }
  }

  async getJobStatus(jobId: string): Promise<{
    status: "queued" | "processing" | "succeeded" | "failed"
    video_url?: string
    error?: string
  }> {
    const response = await fetch(`https://api.piapi.ai/api/v1/task/${jobId}`, {
      headers: {
        'x-api-key': this.config.apiKey
      }
    })

    const data = await response.json()
    const status = data?.data?.status
    const videoUrl = data?.data?.output?.video_url

    // Map Kling status to standard status
    const statusMap: Record<string, "queued" | "processing" | "succeeded" | "failed"> = {
      'pending': 'queued',
      'processing': 'processing',
      'succeeded': 'succeeded',
      'failed': 'failed'
    }

    return {
      status: statusMap[status] || 'processing',
      video_url: videoUrl,
      error: data?.data?.error
    }
  }

  private buildKlingPrompt(shot: any, intent: DirectorIntent): string {
    const framing = shot.framing || 'close-up'
    const motion = shot.motion || 'slow dolly in'
    const emotion = shot.emotion || 'contemplative'
    const imageRef = `@image_${shot.reference_image_index || 1}`

    return `Cinematic ${intent.aspect_ratio}, ${framing}, ${motion}, character ${imageRef}, emotion: ${emotion}, ${shot.action_completed_state}, cinematic lighting, smooth transition`
  }
}

/**
 * Factory function to create KlingAdapter with environment config
 */
export function createKlingAdapter(webhookUrl?: string): KlingAdapter {
  return new KlingAdapter({
    apiKey: process.env.PIAPI_API_KEY!,
    webhookUrl: webhookUrl || process.env.NEXT_PUBLIC_APP_URL + '/api/webhook/piapi'
  })
}
