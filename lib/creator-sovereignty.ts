// Creator Sovereignty - IP Export Module
// Exports all creator-owned content for data portability

import { createClient } from '@/lib/supabase/server'

export interface CreatorIPBundle {
  exportedAt: string
  creatorId: string
  projects: any[]
  assets: any[]
  characters: any[]
  metadata: {
    version: string
    platform: string
  }
}

export async function exportCreatorIPBundle(userId: string): Promise<CreatorIPBundle> {
  const supabase = await createClient()
  
  const [projectsRes, assetsRes, charactersRes] = await Promise.all([
    supabase.from('projects').select('*').eq('creator_id', userId),
    supabase.from('generated_assets').select('*').eq('creator_id', userId),
    supabase.from('character_templates').select('*').eq('creator_id', userId),
  ])

  return {
    exportedAt: new Date().toISOString(),
    creatorId: userId,
    projects: projectsRes.data || [],
    assets: assetsRes.data || [],
    characters: charactersRes.data || [],
    metadata: {
      version: '1.0',
      platform: 'ScriptFlow',
    },
  }
}
