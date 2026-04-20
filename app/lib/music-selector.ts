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
      // 悲伤系列
      'grief': ['grief', 'sad', 'longing'],
      'longing': ['longing', 'grief', 'missing'],
      'regret': ['regret', 'grief', 'sad'],
      'sad': ['sad', 'grief', 'longing'],
      'missing': ['missing', 'longing', 'grief'],
      'lonely': ['lonely', 'grief', 'sad'],
      'memory': ['memory', 'nostalgic', 'longing'],

      // 温暖系列
      'love': ['love', 'romantic', 'warm'],
      'tender': ['tender', 'warm', 'love'],
      'warm': ['warm', 'family', 'tender'],
      'family': ['family', 'warm', 'nostalgic'],
      'nostalgic': ['nostalgic', 'family', 'warm'],
      'home': ['home', 'family', 'warm'],

      // 欢乐系列
      'happy': ['happy', 'fun', 'cheerful'],
      'fun': ['fun', 'happy', 'playful'],
      'prank': ['prank', 'fun', 'happy'],
      'celebration': ['celebration', 'happy', 'cheerful'],
      'cheerful': ['cheerful', 'happy', 'fun'],

      // 萌宠系列
      'pet': ['pet', 'cute', 'playful'],
      'cute': ['cute', 'pet', 'playful'],
      'playful': ['playful', 'pet', 'cute'],
      'animal': ['animal', 'pet', 'cute'],

      // 励志系列
      'epic': ['epic', 'triumph', 'strong'],
      'triumph': ['triumph', 'epic', 'achievement'],
      'achievement': ['achievement', 'epic', 'motivation'],
      'strong': ['strong', 'epic', 'motivation'],
      'motivation': ['motivation', 'epic', 'strong'],

      // 戏剧系列
      'dramatic': ['dramatic', 'tension', 'intense'],
      'tension': ['tension', 'dramatic', 'intense'],
      'intense': ['intense', 'dramatic', 'tension'],
      'suspense': ['suspense', 'tension', 'dramatic'],

      // 爱情系列
      'romantic': ['romantic', 'love', 'tender'],
      'couple': ['couple', 'romantic', 'love'],
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
