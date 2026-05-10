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
  private maxRetries: number = 1

  constructor() {
    this.apiKey = process.env.PIAPI_API_KEY!
    if (!this.apiKey) {
      throw new Error('PIAPI_API_KEY is not configured')
    }
  }

  async generate(params: KlingGenerateParams): Promise<KlingGenerateResult> {
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

    console.log('[KlingAdapter] Generating video - format:', format, 'duration:', duration, 'shots:', shots.length, 'images:', images.length)

    // Retry logic
    let taskId: string | null = null
    let retryCount = 0
    let lastError: any = null

    while (retryCount <= this.maxRetries && !taskId) {
      try {
        if (retryCount > 0) {
          console.log(`[KlingAdapter] Retry attempt ${retryCount}/${this.maxRetries} after 30s...`)
          await new Promise(resolve => setTimeout(resolve, 30000)) // Wait 30 seconds
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
        taskId = data?.data?.task_id

        console.log(`[KlingAdapter] Attempt ${retryCount + 1} - task_id:`, taskId)

        if (!taskId) {
          console.warn(`[KlingAdapter] Attempt ${retryCount + 1} failed:`, JSON.stringify(data).slice(0, 200))
          lastError = data
          retryCount++
        }
      } catch (err) {
        console.error(`[KlingAdapter] Attempt ${retryCount + 1} error:`, err)
        lastError = err
        retryCount++
      }
    }

    if (!taskId) {
      console.error('[KlingAdapter] All retries failed:', JSON.stringify(lastError).slice(0, 200))
      return {
        taskId: null,
        status: 'failed',
        error: 'Kling task creation failed after retries'
      }
    }

    return {
      taskId,
      status: 'success'
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
