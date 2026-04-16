console.log('[worker] PIAPI_API_KEY length:', process.env.PIAPI_API_KEY?.length)
console.log('[worker] PIAPI_API_KEY first 8:', process.env.PIAPI_API_KEY?.slice(0, 8))

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function pollShots() {
  const { data: shots } = await supabase
    .from('movie_shots')
    .select('*')
    .in('status', ['submitted', 'processing'])
    .limit(20)

  if (!shots || shots.length === 0) return

  console.log('[worker] polling', shots.length, 'shots')

  // Poll OmniHuman status
  for (const shot of shots) {
    if (!shot.omni_task_id) continue
    
    try {
      const res = await fetch('https://api.piapi.ai/api/v1/task/' + shot.omni_task_id, {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY }
      })
      const data = await res.json()
      console.log('[worker] PiAPI raw response:', JSON.stringify(data).slice(0, 500))
      const status = data?.data?.status
      const videoUrl = data?.data?.output?.video

      console.log('[worker] shot', shot.shot_index, 'omni status:', status)

      if ((status === 'completed' || status === 'success') && videoUrl) {
        await supabase.from('movie_shots')
          .update({ omni_video_url: videoUrl, status: 'processing' })
          .eq('id', shot.id)
        await supabase.from('omnihuman_jobs')
          .update({ status: 'completed', result_video_url: videoUrl })
          .eq('task_id', shot.omni_task_id)
        console.log('[worker] OmniHuman done for shot', shot.shot_index)
      }
    } catch (e) {
      console.error('[worker] error polling shot', shot.id, e.message)
    }
  }

  // Poll Kling status for shots with kling_task_id
  for (const shot of shots) {
    if (!shot.kling_task_id) continue
    
    try {
      const res = await fetch('https://api.piapi.ai/api/v1/task/' + shot.kling_task_id, {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY }
      })
      const data = await res.json()
      const status = data?.data?.status
      const videoUrl = data?.data?.output?.works?.[0]?.resource?.resource

      console.log('[worker] shot', shot.shot_index, 'kling status:', status)

      if ((status === 'completed' || status === 'success') && videoUrl) {
        await supabase.from('movie_shots')
          .update({ kling_scene_url: videoUrl })
          .eq('id', shot.id)
        console.log('[worker] Kling done for shot', shot.shot_index)
      }
    } catch (e) {
      console.error('[worker] kling poll error:', shot.id, e.message)
    }
  }

  // Check if shots are ready, trigger Shotstack
  // Face shots: need both omni and kling
  const { data: faceShots } = await supabase
    .from('movie_shots')
    .select('*')
    .eq('status', 'processing')
    .eq('shot_type', 'face')
    .not('omni_video_url', 'is', null)
    .not('kling_scene_url', 'is', null)

  // Scene shots: only need kling
  const { data: sceneShots } = await supabase
    .from('movie_shots')
    .select('*')
    .eq('status', 'processing')
    .eq('shot_type', 'scene')
    .not('kling_scene_url', 'is', null)

  const readyShots = [...(faceShots ?? []), ...(sceneShots ?? [])]

  for (const shot of readyShots) {
    console.log('[worker] Ready for shot', shot.shot_index, 'type:', shot.shot_type, '- triggering Shotstack')
    
    const videoSrc = shot.shot_type === 'face' ? shot.omni_video_url : shot.kling_scene_url

    // Call Shotstack to render shot
    try {
      const shotstackRes = await fetch('https://api.shotstack.io/v1/render', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.SHOTSTACK_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeline: {
            tracks: [{
              clips: [{
                asset: { type: 'video', src: videoSrc },
                start: 0, length: shot.duration ?? 10
              }]
            }]
          },
          output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' }
        })
      })
      const shotstackData = await shotstackRes.json()
      console.log('[worker] Shotstack response:', JSON.stringify(shotstackData).slice(0, 300))
      const renderId = shotstackData?.response?.id
      if (renderId) {
        await supabase.from('movie_shots')
          .update({ status: 'merging', shotstack_render_id: renderId })
          .eq('id', shot.id)
        console.log('[worker] Shotstack render started:', renderId)
      } else {
        console.error('[worker] Shotstack no renderId:', JSON.stringify(shotstackData))
      }
    } catch (e) {
      console.error('[worker] Shotstack error:', e.message)
    }
  }
}

async function main() {
  console.log('[worker] Starting ScriptFlow Worker...')
  while (true) {
    try {
      await pollShots()
    } catch (e) {
      console.error('[worker] main error:', e.message)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
}

main()
