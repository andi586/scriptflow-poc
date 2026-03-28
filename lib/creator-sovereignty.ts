import { createClient } from '@/lib/supabase/server'

export interface IPBundle {
  creatorId: string
  exportedAt: string
  characters: unknown[]
  scripts: unknown[]
  nelModel: unknown | null
  revenueHistory: unknown[]
}

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringField(record: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

export async function exportCreatorIPBundle(creatorId: string): Promise<IPBundle> {
  const safeCreatorId = creatorId.trim()
  if (!safeCreatorId) throw new Error('creatorId is required')
  const supabase = await createClient()
  const [charactersResult, scriptsResult, assetsResult] = await Promise.all([
    supabase.from('characters').select('*').eq('creator_id', safeCreatorId),
    supabase.from('scripts').select('*').eq('creator_id', safeCreatorId),
    supabase.from('generated_assets').select('*').eq('creator_id', safeCreatorId),
  ])
  if (charactersResult.error) throw new Error(`Failed to export characters: ${charactersResult.error.message}`)
  if (scriptsResult.error) throw new Error(`Failed to export scripts: ${scriptsResult.error.message}`)
  if (assetsResult.error) throw new Error(`Failed to export revenue history: ${assetsResult.error.message}`)
  return {
    creatorId: safeCreatorId,
    exportedAt: new Date().toISOString(),
    characters: (charactersResult.data ?? []) as unknown[],
    scripts: (scriptsResult.data ?? []) as unknown[],
    nelModel: null,
    revenueHistory: (assetsResult.data ?? []) as unknown[],
  }
}

export async function verifyAssetOwnership(creatorId: string, assetId: string): Promise<boolean> {
  const safeCreatorId = creatorId.trim()
  const safeAssetId = assetId.trim()
  if (!safeCreatorId || !safeAssetId) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('generated_assets')
    .select('*')
    .eq('id', safeAssetId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Failed to verify asset ownership: ${error.message}`)
  if (!data || !isJsonRecord(data)) return false
  const ownerId = readStringField(data, 'creator_id', 'owner_id', 'user_id')
  return ownerId === safeCreatorId
}
