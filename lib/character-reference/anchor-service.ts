import { createClient } from '@/lib/supabase/server'
import type { CharacterAnchorPack, CharacterContinuityState } from './types'

export async function getCharacterAnchorPack(characterId: string): Promise<CharacterAnchorPack | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('character_reference_assets')
    .select('*')
    .eq('character_id', characterId)
    .order('sort_order')
    .limit(4)
  if (error || !data || data.length === 0) return null
  return {
    characterId,
    images: data.map(r => ({
      id: r.id,
      characterId: r.character_id,
      imageType: r.image_type,
      storagePath: r.storage_path,
      publicUrl: r.public_url,
      sortOrder: r.sort_order,
      isPrimary: r.is_primary
    }))
  }
}

export async function getContinuityState(episodeId: string, characterId: string): Promise<CharacterContinuityState | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('character_continuity_state')
    .select('*')
    .eq('episode_id', episodeId)
    .eq('character_id', characterId)
    .maybeSingle()
  if (error || !data) return null
  return {
    episodeId: data.episode_id,
    characterId: data.character_id,
    latestSuccessfulVideoUrl: data.latest_successful_video_url,
    latestSuccessfulTaskId: data.latest_successful_task_id
  }
}

export async function updateContinuityState(episodeId: string, characterId: string, videoUrl: string, taskId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('character_continuity_state')
    .upsert({
      episode_id: episodeId,
      character_id: characterId,
      latest_successful_video_url: videoUrl,
      latest_successful_task_id: taskId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'episode_id,character_id' })
}
