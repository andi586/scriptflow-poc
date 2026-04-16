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
    .in('status', ['submitted', 'processing', 'merging'])
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

  // Poll Shotstack for merging shots
  const { data: mergingShots } = await supabase
    .from('movie_shots')
    .select('*')
    .eq('status', 'merging')
    .not('shotstack_render_id', 'is', null)

  for (const shot of mergingShots ?? []) {
    try {
      const res = await fetch('https://api.shotstack.io/v1/render/' + shot.shotstack_render_id, {
        headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY }
      })
      const data = await res.json()
      const status = data?.response?.status
      const url = data?.response?.url

      console.log('[worker] Shotstack poll shot', shot.shot_index, 'status:', status)

      if (status === 'done' && url) {
        await supabase.from('movie_shots')
          .update({ final_shot_url: url, status: 'done' })
          .eq('id', shot.id)
        console.log('[worker] Shot complete:', shot.shot_index, url)
      } else if (status === 'failed') {
        await supabase.from('movie_shots')
          .update({ status: 'pending', retry_count: (shot.retry_count ?? 0) + 1 })
          .eq('id', shot.id)
        console.log('[worker] Shot failed, resetting:', shot.shot_index)
      }
    } catch (e) {
      console.error('[worker] Shotstack poll error:', e.message)
    }
  }

  // Stage 5: Assemble complete movies
  const { data: doneShots } = await supabase
    .from('movie_shots')
    .select('movie_id')
    .eq('status', 'done')

  if (doneShots && doneShots.length > 0) {
    const movieIds = [...new Set(doneShots.map(s => s.movie_id))]
    
    for (const movieId of movieIds) {
      // Check if all shots for this movie are done
      const { data: allShots } = await supabase
        .from('movie_shots')
        .select('*')
        .eq('movie_id', movieId)
        .order('shot_index')
      
      const allDone = allShots?.every(s => s.status === 'done')
      if (!allDone) continue
      
      // Check if movie already being assembled
      const { data: existingMovie } = await supabase
        .from('movies')
        .select('*')
        .eq('id', movieId)
        .single()
      
      if (existingMovie?.status === 'rendering' || existingMovie?.status === 'complete') continue
      
      console.log('[worker] Assembling movie:', movieId, 'shots:', allShots.length)
      
      // Build Shotstack timeline with all shots in order
      const clips = allShots.map((shot, i) => ({
        asset: { type: 'video', src: shot.final_shot_url },
        start: allShots.slice(0, i).reduce((sum, s) => sum + (s.duration ?? 10), 0),
        length: shot.duration ?? 10
      }))
      
      const shotstackRes = await fetch('https://api.shotstack.io/v1/render', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.SHOTSTACK_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timeline: {
            tracks: [{ clips }]
          },
          output: { format: 'mp4', resolution: 'hd', aspectRatio: '9:16' }
        })
      })
      
      const shotstackData = await shotstackRes.json()
      const renderId = shotstackData?.response?.id
      
      if (renderId) {
        // Upsert movie record
        await supabase.from('movies').upsert({
          id: movieId,
          status: 'rendering',
          shotstack_render_id: renderId,
          total_shots: allShots.length
        })
        console.log('[worker] Movie render started:', movieId, renderId)
      }
    }
  }

  // Stage 6: Poll movie renders
  const { data: renderingMovies } = await supabase
    .from('movies')
    .select('*')
    .eq('status', 'rendering')

  for (const movie of renderingMovies ?? []) {
    try {
      const res = await fetch('https://api.shotstack.io/v1/render/' + movie.shotstack_render_id, {
        headers: { 'x-api-key': process.env.SHOTSTACK_API_KEY }
      })
      const data = await res.json()
      const status = data?.response?.status
      const url = data?.response?.url

      console.log('[worker] Movie render status:', movie.id, status)

      if (status === 'done' && url) {
        await supabase.from('movies')
          .update({ status: 'complete', final_video_url: url })
          .eq('id', movie.id)
        await supabase.from('movie_shots')
          .update({ status: 'final_complete' })
          .eq('movie_id', movie.id)
        console.log('[worker] Movie complete:', movie.id, url)
      }
    } catch (e) {
      console.error('[worker] Movie render poll error:', e.message)
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
