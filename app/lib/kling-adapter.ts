export interface KlingGenerateParams {
  shots: Array<{ prompt: string; duration: number }>
  images: string[]
  duration: number
  format: string
  webhookUrl?: string
}

export interface KlingGenerateResult {
  taskId: string | null
  status: 'success' | 'failed'
  error?: string
}

export class KlingAdapter {
  private apiKey: string
  private maxRetries: number = 3

  constructor() {
    this.apiKey = process.env.PIAPI_API_KEY!
    if (!this.apiKey) {
      throw new Error('PIAPI_API_KEY is not configured')
    }
  }

  private async callKlingAPI(params: KlingGenerateParams): Promise<KlingGenerateResult> {
    const { shots, images, duration, format, webhookUrl } = params

    // Prepare Kling API request body
    const klingBody = {
      model: 'kling',
      task_type: 'omni_video_generation',
      input: {
        version: '3.0',
        resolution: '720p',
        aspect_ratio: '9:16',
        enable_audio: true,
        language: 'en',  // Force English TTS for all dialogue
        images: images.filter(Boolean).slice(0, 7), // Kling supports max 7 images
        multi_shots: shots
      },
      config: {
        service_mode: 'public',
        webhook_config: {
          endpoint: webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/piapi`,
          secret: ''
        }
      }
    }

    const response = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(klingBody)
    })

    const data = await response.json()
    const taskId = data?.data?.task_id

    if (!taskId) {
      throw new Error(`Kling API returned no task_id: ${JSON.stringify(data).slice(0, 200)}`)
    }

    return {
      taskId,
      status: 'success'
    }
  }

  async generate(params: KlingGenerateParams): Promise<KlingGenerateResult> {
    const { shots, images, duration, format } = params
    
    console.log('[KlingAdapter] Generating video - format:', format, 'duration:', duration, 'shots:', shots.length, 'images:', images.length)

    // Try Kling up to 3 times
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[KlingAdapter] Attempt ${attempt}/${this.maxRetries}`)
        const result = await this.callKlingAPI(params)
        
        if (result.taskId) {
          console.log(`[KlingAdapter] Success on attempt ${attempt} - task_id:`, result.taskId)
          return result
        }
      } catch (err) {
        console.error(`[KlingAdapter] Attempt ${attempt}/${this.maxRetries} failed:`, err)
        
        if (attempt === this.maxRetries) {
          console.error('[KlingAdapter] All attempts failed')
          return {
            taskId: null,
            status: 'failed',
            error: 'Video generation failed after 3 attempts'
          }
        }
        
        // Wait 2 seconds before retry
        console.log(`[KlingAdapter] Waiting 2s before retry...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    // Fallback (should never reach here)
    return {
      taskId: null,
      status: 'failed',
      error: 'Video generation failed after all retries'
    }
  }

  async checkStatus(taskId: string): Promise<any> {
    try {
      const response = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: {
          'x-api-key': this.apiKey
        }
      })
      return await response.json()
    } catch (err) {
      console.error('[KlingAdapter] Status check failed:', err)
      throw err
    }
  }
}
