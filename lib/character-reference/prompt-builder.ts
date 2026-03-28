export function buildConsistencyPrompt(params: {
  basePrompt: string
  imageCount: number
  useVideoRelay: boolean
}): string {
  const { basePrompt, imageCount, useVideoRelay } = params

  const identityBlock = imageCount >= 4
    ? 'Use @image_1 as the main identity anchor, @image_2 and @image_3 as side-angle identity references, @image_4 as costume and body-shape reference.'
    : Array.from({ length: imageCount }, (_, i) => '@image_' + (i + 1)).join(', ') + ' as identity references for the same character.'

  const continuityBlock = useVideoRelay
    ? 'Use @video as the continuity reference for motion, hairstyle state, costume state, and lighting.'
    : ''

  const constraintBlock = 'Preserve the exact same identity, facial structure, hairstyle, age impression, skin tone, body proportion, and costume details. No identity drift. No wardrobe change. No extra accessories. Change only camera angle, composition, and action required by the scene.'

  return [continuityBlock, identityBlock, basePrompt, constraintBlock]
    .filter(Boolean)
    .join(' ')
}
