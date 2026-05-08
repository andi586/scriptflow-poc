import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { selectBGMv2 } from '@/app/lib/bgm-selector-v2'
import { getLockedBGM } from '@/app/lib/execution-authority'

const ENDING_LINE_LIBRARY: Record<string, string> = {
  'she_didnt_choose_you': "Trust doesn't come back.",
  'lost_someone': "Thank you for being my human.",
  'last_person': "Real friends don't need a group chat.",
  'future_you': "Don't make my mistakes.",
  'friend_betrayal': "He told them everything.",
  'what_could_have_been': "Some paths are beautiful because we didn't take them.",
  'breaking_news': "The truth always finds a camera.",
  'parallel_universe': "Some doors should stay closed.",
  'phone_3am': "Trust doesn't come back.",
  'future_warning': "Don't make my mistakes.",
  'group_chat': "Real friends don't need a group chat.",
  'dog_last_words': "Thank you for being my human.",
  // Legacy archetypes
  'pet_daily': "Every moment was a gift.",
  'playful_chaos': "Life is better with you.",
  'late_regret': "Some words come too late.",
  'heartbreak': "Love doesn't always stay.",
  'lonely_reflection': "Sometimes alone is better.",
  'hero_moment': "This is who I was meant to be.",
  'martial_arts': "Strength comes from within.",
  'chase_escape': "Freedom has a price.",
  'unspoken_love': "I should have said it.",
  'reconciliation': "Forgiveness changes everything.",
  'spring_festival': "Home is where the heart returns.",
  'christmas': "Magic lives in the moments we share."
}

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
    .select('id, story_input, archetype, script_raw')
    .eq('kling_task_id', taskId)
    .single()

  const FFMPEG_URL = 'https://scriptflow-video-merge-production.up.railway.app'

  if (movie) {
    const movieArchetype = movie.archetype || 'neutral'
    const bgmUrl = getLockedBGM(movieArchetype)
    
    console.log('[webhook] movie found:', movie.id)
    console.log('[webhook] archetype:', movieArchetype)
    console.log('[webhook] bgmUrl:', bgmUrl)
    
    // Save raw video immediately
    await supabaseAdmin.from('movies')
      .update({ 
        final_video_url: videoUrl,
        status: 'processing'
      })
      .eq('id', movie.id)
    
    // Get dialogue from script
    const scriptData = movie.script_raw
    let dialogueLines: string[] = []
    if (scriptData?.shots) {
      dialogueLines = scriptData.shots
        .map((s: any) => s.dialogue)
        .filter(Boolean)
    }
    
    console.log('[webhook] dialogue lines:', dialogueLines.length)
    
    // Fire Railway finalize (fire and forget)
    fetch(`${FFMPEG_URL}/api/finalize-movie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: videoUrl,
        movieId: movie.id,
        archetype: movieArchetype,
        dialogueLines: dialogueLines,
        bgmUrl: bgmUrl
      })
    }).then(r => console.log('[webhook] Railway triggered:', r.status))
      .catch(err => console.error('[webhook] Railway error:', err))
    
    // Trigger hook generation
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://getscriptflow.com'
    fetch(`${appUrl}/api/hook/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: movie.id })
    }).catch(err => console.error('[webhook] hook error:', err))
  }

  console.log('[webhook/piapi] updated task:', taskId)
  return NextResponse.json({ ok: true })
}
