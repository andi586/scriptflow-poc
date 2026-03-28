import type { CharacterAnchorPack, CharacterContinuityState } from './types'
import { buildConsistencyPrompt } from './prompt-builder'

export function buildKlingConsistencyPayload(params: {
  basePrompt: string
  anchorPack: CharacterAnchorPack | null
  continuityState: CharacterContinuityState | null
  durationSec?: number
  aspectRatio?: string
  webhookUrl?: string
  webhookSecret?: string
}) {
  const { basePrompt, anchorPack, continuityState, durationSec = 5, aspectRatio = '9:16', webhookUrl, webhookSecret } = params
  const imageUrls = anchorPack ? anchorPack.images.slice(0, 4).map(img => img.publicUrl) : []
  const videoUrl = continuityState?.latestSuccessfulVideoUrl ?? undefined
  const useVideoRelay = Boolean(videoUrl)
  const prompt = buildConsistencyPrompt({ basePrompt, imageCount: imageUrls.length, useVideoRelay })
  const input: Record<string, unknown> = {
    version: '3.0',
    prompt,
    resolution: '1080p',
    duration: durationSec,
    aspect_ratio: aspectRatio,
    enable_audio: false
  }
  if (imageUrls.length > 0) input.images = imageUrls
  if (videoUrl) {
    input.video = videoUrl
    input.keep_original_audio = false
  }
  const payload: Record<string, unknown> = {
    model: 'kling',
    task_type: 'omni_video_generation',
    input,
    config: { service_mode: 'public' }
  }
  if (webhookUrl) {
    payload.config = {
      service_mode: 'public',
      webhook_config: { endpoint: webhookUrl, secret: webhookSecret }
    }
  }
  return payload
}
