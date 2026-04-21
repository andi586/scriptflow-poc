import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { selectBGMv2 } from '@/app/lib/bgm-selector-v2'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const taskId = payload?.data?.task_id
  const status = payload?.data?.status
  const videoUrl = payload?.data?.output?.video

  console.log('[webhook/piapi] received:', taskId, status)

  if (!taskId || status !== 'completed' || !videoUrl) {
    return NextResponse.json({ ok: false })
  }

  // Update omnihuman_jobs
  await supabaseAdmin.from('omnihuman_jobs')
    .update({ status: 'completed', result_video_url: videoUrl })
    .eq('task_id', taskId)

  // Update movie_shots omni_video_url
  await supabaseAdmin.from('movie_shots')
    .update({ omni_video_url: videoUrl, status: 'processing' })
    .eq('omni_task_id', taskId)

  // Update movie_shots kling_scene_url  
  await supabaseAdmin.from('movie_shots')
    .update({ kling_scene_url: videoUrl, status: 'processing' })
    .eq('kling_task_id', taskId)

  // Update movies table (new single Kling 3.0 architecture)
  // First, look up the movie to get its id
  const { data: movie } = await supabaseAdmin.from('movies')
    .select('id, story_input')
    .eq('kling_task_id', taskId)
    .single()

  const FFMPEG_URL = 'https://scriptflow-video-merge-production.up.railway.app'

  // Add BGM to video
  let finalVideoUrl = videoUrl
  if (movie) {
    // Get story profile from movie or detect from story_input
    const story = movie.story_input || ''
    const s = story.toLowerCase()

    // Detect primary emotion from story text, mapping archetypes → BGM emotion keys
    const detectPrimaryEmotion = (s: string): string => {
      // Action archetypes
      if (['武打', '功夫', 'martial arts', 'fight', '战争', '牺牲', 'war', '街头', '打架', '英雄', 'hero', '追逐', '逃跑', 'chase'].some(k => s.includes(k))) return 'action'
      // Travel
      if (['旅行', '旅游', 'travel', 'travel_memory'].some(k => s.includes(k))) return 'travel'
      // Fitness
      if (['健身', '运动', 'fitness', 'training', 'workout'].some(k => s.includes(k))) return 'fitness'
      // Baby
      if (['宝宝', '成长', 'baby', 'baby_growth'].some(k => s.includes(k))) return 'baby'
      // Wedding
      if (['婚礼', '结婚', 'wedding', 'wedding_memory'].some(k => s.includes(k))) return 'wedding'
      // Nostalgia
      if (['童年', '小时候', 'childhood', '回忆', 'memory', 'nostalgia', '怀念'].some(k => s.includes(k))) return 'nostalgia'
      // Betrayal
      if (['背叛', 'betrayal'].some(k => s.includes(k))) return 'betrayal'
      // Hope
      if (['希望', 'hope'].some(k => s.includes(k))) return 'hope'
      // Inspiring (comeback_story / exam_victory / startup_hustle)
      if (['逆转', 'comeback', '考试', '成绩', 'exam', '创业', 'startup', '奋斗', 'hustle', '励志', 'inspiring'].some(k => s.includes(k))) return 'inspiring'
      // Festive (spring_festival / christmas / birthday_celebration)
      if (['春节', '过年', 'spring festival', '新年', '圣诞', 'christmas', '生日', 'birthday', '节日', 'festive'].some(k => s.includes(k))) return 'festive'
      // Funny (prank_friend / fail_moments / pet_funny / awkward_daily)
      if (['整蛊', 'prank', '搞笑', '恶作剧', '翻车', 'fail', '出糗', '宠物搞笑', '逗猫', '逗狗', '尴尬', 'awkward', 'funny'].some(k => s.includes(k))) return 'funny'
      // Bittersweet (bittersweet / letting_go / self_discovery)
      if (['放下', '释怀', 'letting go', '自我', '觉醒', 'self discovery', 'bittersweet', '苦涩'].some(k => s.includes(k))) return 'bittersweet'
      // Legacy emotion detection
      if (['猫', 'dog', 'cat', 'pet', '宠物'].some(k => s.includes(k))) return 'playful'
      if (['妈', 'mom', 'miss', '想你'].some(k => s.includes(k))) return 'grief'
      if (['爱', 'love'].some(k => s.includes(k))) return 'romantic'
      if (['家', 'family'].some(k => s.includes(k))) return 'warm'
      return 'warm'
    }

    const primaryEmotion = detectPrimaryEmotion(s)

    // Use buildStoryProfile to get precise valence/arousal/bannedDirections from emotion overrides
    const { buildStoryProfile } = await import('@/app/lib/bgm-selector-v2')
    const storyProfile = buildStoryProfile({ primaryEmotion })
    // Enrich protagonistType and setting from story text
    if (s.includes('猫') || s.includes('dog') || s.includes('cat') || s.includes('pet') || s.includes('宠物')) {
      storyProfile.protagonistType = 'pet'
    } else if (s.includes('家') || s.includes('family') || s.includes('妈') || s.includes('爸')) {
      storyProfile.protagonistType = 'family'
    } else if (s.includes('爱') || s.includes('love')) {
      storyProfile.protagonistType = 'couple'
    }
    storyProfile.setting = s.includes('outdoor') || s.includes('park') || s.includes('nature') ? 'outdoor' : 'indoor'

    console.log('[webhook] story profile:', storyProfile.primaryEmotion, storyProfile.valence, storyProfile.arousal)
    const bgmUrl = await selectBGMv2(storyProfile)
    console.log('[webhook] BGM selected:', bgmUrl)
    try {
      const mergeRes = await fetch(`${FFMPEG_URL}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: movie.id,
          videoUrls: [videoUrl],
          bgmUrl: bgmUrl,
          audioUrls: [],
          projectTitle: 'ScriptFlow Movie'
        })
      })
      const mergeData = await mergeRes.json()
      if (mergeData.success && mergeData.finalVideoUrl) {
        finalVideoUrl = mergeData.finalVideoUrl
        console.log('[webhook] BGM added:', finalVideoUrl)
      }
    } catch (e) {
      console.error('[webhook] BGM merge failed, using original:', e)
      // Fall back to original video if BGM fails
    }
  }

  // Update movies table with final merged video
  await supabaseAdmin.from('movies')
    .update({ 
      final_video_url: finalVideoUrl,
      status: 'complete'
    })
    .eq('kling_task_id', taskId)

  console.log('[webhook/piapi] updated task:', taskId)
  return NextResponse.json({ ok: true })
}
