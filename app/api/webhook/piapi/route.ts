import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { selectBGM } from '@/app/lib/music-selector'

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
    const detectEmotion = (story: string): string => {
      const s = story.toLowerCase()
      if (s.includes('妈') || s.includes('mama') || s.includes('mom') || s.includes('miss') || s.includes('想你') || s.includes('思念')) return 'grief'
      if (s.includes('爱') || s.includes('love') || s.includes('情') || s.includes('心')) return 'love'
      if (s.includes('哈') || s.includes('笑') || s.includes('prank') || s.includes('funny') || s.includes('搞笑')) return 'happy'
      if (s.includes('猫') || s.includes('狗') || s.includes('pet') || s.includes('dog') || s.includes('cat')) return 'pet'
      if (s.includes('家') || s.includes('family') || s.includes('父') || s.includes('father')) return 'family'
      if (s.includes('成功') || s.includes('success') || s.includes('victory') || s.includes('achieve')) return 'epic'
      return 'warm' // default
    }
    const emotion = detectEmotion(movie.story_input || '')
    const bgmUrl = await selectBGM(emotion)
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
