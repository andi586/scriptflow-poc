export type ReferenceImageType = 'front' | 'left_45' | 'right_45' | 'half_body'

export interface CharacterReferenceAsset {
  id: string
  characterId: string
  imageType: ReferenceImageType
  storagePath: string
  publicUrl: string
  sortOrder: number
  isPrimary: boolean
}

export interface CharacterAnchorPack {
  characterId: string
  images: CharacterReferenceAsset[]
}

export interface CharacterContinuityState {
  episodeId: string
  characterId: string
  latestSuccessfulVideoUrl: string | null
  latestSuccessfulTaskId: string | null
}
