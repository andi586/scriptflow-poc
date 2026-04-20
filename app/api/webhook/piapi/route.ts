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

    // Build basic story profile
    const storyProfile = {
      primaryEmotion: s.includes('猫') || s.includes('dog') || s.includes('cat') || s.includes('pet') ? 'playful' :
                      s.includes('妈') || s.includes('mom') || s.includes('miss') || s.includes('想你') ? 'grief' :
                      s.includes('爱') || s.includes('love') ? 'romantic' :
                      s.includes('哈') || s.includes('prank') || s.includes('funny') ? 'playful' :
                      s.includes('家') || s.includes('family') ? 'warm' : 'warm',
      valence: s.includes('妈') || s.includes('miss') || s.includes('想你') ? -0.6 :
               s.includes('猫') || s.includes('cat') || s.includes('happy') || s.includes('哈') ? 0.8 :
               s.includes('爱') || s.includes('love') ? 0.7 : 0.5,
      arousal: s.includes('猫') || s.includes('cat') || s.includes('prank') || s.includes('哈') ? 0.7 :
               s.includes('妈') || s.includes('miss') ? 0.2 :
               s.includes('爱') || s.includes('love') ? 0.4 : 0.5,
      protagonistType: s.includes('猫') || s.includes('dog') || s.includes('cat') || s.includes('pet') ? 'pet' :
                       s.includes('家') || s.includes('family') || s.includes('妈') || s.includes('爸') ? 'family' :
                       s.includes('爱') || s.includes('love') ? 'couple' : 'human',
      setting: s.includes('outdoor') || s.includes('park') || s.includes('nature') ? 'outdoor' : 'indoor',
      bannedDirections: 
        s.includes('猫') || s.includes('cat') || s.includes('pet') ? ['grief', 'horror', 'drama'] :
        s.includes('妈') || s.includes('miss') || s.includes('想你') ? ['comedy', 'prank', 'horror'] :
        s.includes('哈') || s.includes('prank') ? ['grief', 'horror'] : []
    }

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
