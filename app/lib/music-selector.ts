import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function selectBGM(emotion: string): Promise<string> {
  // Default fallback BGM
  const DEFAULT_BGM = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  
  try {
    // Map emotion to tags
    const emotionMap: Record<string, string[]> = {
      'grief': ['grief', 'sad', 'longing'],
      'longing': ['longing', 'grief', 'sad'],
      'regret': ['regret', 'grief', 'sad'],
      'love': ['love', 'romantic', 'warm'],
      'tender': ['tender', 'warm', 'love'],
      'happy': ['happy', 'fun', 'celebration'],
      'fun': ['fun', 'happy', 'playful'],
      'prank': ['prank', 'fun', 'happy'],
      'pet': ['pet', 'cute', 'playful'],
      'epic': ['epic', 'triumph', 'strong'],
      'dramatic': ['dramatic', 'tension', 'intense'],
      'family': ['family', 'warm', 'nostalgic'],
      'nostalgic': ['nostalgic', 'family', 'warm'],
    }

    const tags = emotionMap[emotion.toLowerCase()] || ['warm']
    
    // Find matching music
    const { data } = await supabase
      .from('music_assets')
      .select('url')
      .eq('status', 'free')
      .eq('approved', true)
      .contains('emotion_tags', [tags[0]])
      .limit(5)
    
    if (!data || data.length === 0) return DEFAULT_BGM
    
    // Pick randomly from matches
    const random = data[Math.floor(Math.random() * data.length)]
    return random.url
    
  } catch (e) {
    console.error('[music-selector] error:', e)
    return DEFAULT_BGM
  }
}
