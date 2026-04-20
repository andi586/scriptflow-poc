import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BgmProfile {
  id: string
  title: string
  url: string
  primaryMood: string
  valence: number      // -1 to 1 (negative=sad, positive=happy)
  arousal: number      // 0 to 1 (low=calm, high=energetic)
  warmth: number       // 0 to 1
  playfulness: number  // 0 to 1
  darkness: number     // 0 to 1
  tension: number      // 0 to 1
  pacing: string       // slow/medium/fast
  suitableForCharacters: string[]  // pet/human/family/couple
  suitableForSettings: string[]    // indoor/outdoor/nature/city
  unsuitableFor: string[]          // horror/grief/comedy/epic
  editorialQualityScore: number    // 0-100
}

interface StoryProfile {
  primaryEmotion: string
  valence: number
  arousal: number
  protagonistType: string
  setting: string
  bannedDirections: string[]
}

function scoreBgm(story: StoryProfile, bgm: BgmProfile): number {
  // Conflict penalty - immediate disqualifier
  if (story.bannedDirections.some(b => bgm.unsuitableFor.includes(b))) return -1

  let score = 0

  // Emotion match (28%)
  const valenceDiff = 1 - Math.abs(story.valence - bgm.valence)
  const arousalDiff = 1 - Math.abs(story.arousal - bgm.arousal)
  score += 0.28 * (valenceDiff * 0.5 + arousalDiff * 0.5)

  // Character match (20%)
  score += 0.20 * (bgm.suitableForCharacters.includes(story.protagonistType) ? 1 : 0.3)

  // Setting match (12%)
  score += 0.12 * (bgm.suitableForSettings.includes(story.setting) ? 1 : 0.5)

  // Quality (20%)
  score += 0.20 * (bgm.editorialQualityScore / 100)

  // Playfulness bonus for pet/prank stories
  if (story.primaryEmotion === 'playful' || story.primaryEmotion === 'pet') {
    score += 0.20 * bgm.playfulness
  }

  // Darkness penalty for happy stories
  if (story.valence > 0.5 && bgm.darkness > 0.5) {
    score -= 0.30 * bgm.darkness
  }

  return score
}

export async function selectBGMv2(storyProfile: StoryProfile): Promise<string> {
  const DEFAULT_BGM = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'

  try {
    console.log('[bgm-v2] storyProfile:', storyProfile)

    const { data: tracks } = await supabase
      .from('music_assets')
      .select('*')
      .eq('status', 'free')
      .eq('approved', true)

    console.log('[bgm-v2] total tracks fetched:', tracks?.length ?? 0)

    if (!tracks || tracks.length === 0) {
      console.log('[bgm-v2] no tracks in DB, using default BGM')
      return DEFAULT_BGM
    }

    // Score all tracks
    const scored = tracks
      .map(track => ({
        url: track.url,
        score: scoreBgm(storyProfile, {
          id: track.id,
          title: track.title || '',
          url: track.url,
          primaryMood: track.mood || 'neutral',
          valence: track.valence ?? 0.5,
          arousal: track.arousal ?? 0.5,
          warmth: track.warmth ?? 0.5,
          playfulness: track.playfulness ?? 0.3,
          darkness: track.darkness ?? 0.1,
          tension: track.tension ?? 0.2,
          pacing: track.pacing || 'medium',
          suitableForCharacters: track.suitable_for_characters || [],
          suitableForSettings: track.suitable_for_settings || [],
          unsuitableFor: track.unsuitable_for || [],
          editorialQualityScore: track.editorial_quality_score ?? 70
        })
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)

    console.log('[bgm-v2] top 3:', scored.slice(0, 3).map(s => ({ url: s.url, score: s.score.toFixed(3) })))

    if (scored.length === 0) {
      console.log('[bgm-v2] all tracks disqualified, using default BGM')
      return DEFAULT_BGM
    }

    console.log('[bgm-v2] selected:', scored[0].url, 'score:', scored[0].score.toFixed(3))
    return scored[0].url

  } catch (e) {
    console.error('[bgm-v2] error:', e)
    return DEFAULT_BGM
  }
}

/**
 * Build a StoryProfile from ProducerOutput fields.
 * Use this to bridge cognitive-core output → selectBGMv2.
 */
export function buildStoryProfile(opts: {
  primaryEmotion: string
  story_category?: string
  abstraction_level?: number
  tone?: string
}): StoryProfile {
  const { primaryEmotion, story_category, abstraction_level = 0.3, tone = 'warm' } = opts

  // Derive valence from emotion/category
  const valenceMap: Record<string, number> = {
    grief: -0.8, sad: -0.7, longing: -0.6, regret: -0.6, missing: -0.6, lonely: -0.7,
    love: 0.7, tender: 0.6, warm: 0.6, family: 0.5, nostalgic: 0.3, home: 0.5,
    happy: 0.9, fun: 0.8, prank: 0.7, celebration: 0.9, cheerful: 0.8,
    pet: 0.7, cute: 0.8, playful: 0.8, animal: 0.6,
    epic: 0.6, triumph: 0.8, achievement: 0.7, strong: 0.5, motivation: 0.6,
    dramatic: -0.2, tension: -0.3, intense: -0.1, suspense: -0.4,
    romantic: 0.8, couple: 0.7,
  }

  // Derive arousal from tone
  const arousalMap: Record<string, number> = {
    playful: 0.8, funny: 0.7, epic: 0.9, prank: 0.8,
    warm: 0.4, tender: 0.3, sad: 0.2, grief: 0.2,
    dramatic: 0.7, intense: 0.8, suspense: 0.7,
    nostalgic: 0.3, family: 0.4, love: 0.5,
  }

  const valence = valenceMap[primaryEmotion] ?? valenceMap[story_category ?? ''] ?? 0.5
  const arousal = arousalMap[tone] ?? arousalMap[primaryEmotion] ?? 0.5

  // Protagonist type from story_category
  const protagonistMap: Record<string, string> = {
    pet: 'pet', family: 'family', love: 'couple', grief: 'human',
    prank: 'human', achievement: 'human', nostalgia: 'human', hope: 'human',
  }
  const protagonistType = protagonistMap[story_category ?? ''] ?? 'human'

  // Banned directions based on valence
  const bannedDirections: string[] = []
  if (valence > 0.5) bannedDirections.push('horror', 'grief')
  if (valence < -0.3) bannedDirections.push('comedy')

  return {
    primaryEmotion,
    valence,
    arousal,
    protagonistType,
    setting: 'indoor',
    bannedDirections,
  }
}
