import type { SupabaseClient } from '@supabase/supabase-js'

export type GenerationStatus = 'idle' | 'analyzing' | 'generating_video' | 'generating_audio' | 'merging' | 'completed' | 'failed'

export async function updateGenerationStatus(
  supabase: SupabaseClient,
  projectId: string,
  status: GenerationStatus,
  finalVideoUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { generation_status: status }

  switch (status) {
    case 'generating_audio': updates.audio_generated_at = now; break
    case 'generating_video': updates.video_generated_at = now; break
    case 'merging': updates.merged_at = now; break
    case 'completed':
      updates.merged_at = now
      if (finalVideoUrl) updates.final_video_url = finalVideoUrl
      break
  }

  const { error } = await supabase.from('projects').update(updates).eq('id', projectId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getGenerationStatus(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('generation_status, final_video_url, audio_generated_at, video_generated_at, merged_at')
    .eq('id', projectId)
    .single()
  if (error) return null
  return data
}

export async function resetGenerationStatus(supabase: SupabaseClient, projectId: string) {
  return updateGenerationStatus(supabase, projectId, 'idle')
}
