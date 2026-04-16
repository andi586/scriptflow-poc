import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function pollShots() {
  const { data: shots } = await supabase
    .from('movie_shots')
    .select('*')
    .in('status', ['submitted', 'processing'])
    .limit(20)

  for (const shot of shots ?? []) {
    if (shot.omni_task_id) {
      const res = await fetch(`https://api.piapi.ai/api/v1/task/${shot.omni_task_id}`, {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY! }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await res.json() as any
      const status = data?.data?.status
      const videoUrl = data?.data?.output?.video

      if (status === 'completed' && videoUrl) {
        await supabase.from('movie_shots')
          .update({ omni_video_url: videoUrl, status: 'processing' })
          .eq('id', shot.id)
        console.log('[worker] OmniHuman done:', shot.id)
      }
    }
  }
}

async function main() {
  console.log('[worker] Starting ScriptFlow Worker...')
  while (true) {
    try {
      await pollShots()
    } catch (e) {
      console.error('[worker] Error:', e)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
}

main()
