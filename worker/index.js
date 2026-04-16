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

  for (const shot of shots) {
    if (!shot.omni_task_id) continue
    
    try {
      const res = await fetch('https://api.piapi.ai/api/v1/task/' + shot.omni_task_id, {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY }
      })
      const data = await res.json()
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
