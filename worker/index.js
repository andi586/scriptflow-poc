// ScriptFlow Worker - simplified single Kling 3.0 architecture
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function pollMovies() {
  const { data: processingMovies } = await supabase
    .from('movies')
    .select('*')
    .eq('status', 'processing')
    .not('kling_task_id', 'is', null)

  console.log('[worker] processing movies:', processingMovies?.length ?? 0)

  for (const movie of processingMovies ?? []) {
    try {
      const res = await fetch(`https://api.piapi.ai/api/v1/task/${movie.kling_task_id}`, {
        headers: { 'x-api-key': process.env.PIAPI_API_KEY }
      })
      const data = await res.json()
      const status = data?.data?.status
      const videoUrl = data?.data?.output?.video

      console.log('[worker] movie', movie.id, 'kling status:', status)

      if ((status === 'completed' || status === 'success') && videoUrl) {
        await supabase.from('movies')
          .update({ final_video_url: videoUrl, status: 'complete' })
          .eq('id', movie.id)
        console.log('[worker] Movie complete:', movie.id, videoUrl)
      } else if (status === 'failed') {
        await supabase.from('movies')
          .update({ status: 'failed' })
          .eq('id', movie.id)
        console.log('[worker] Movie failed:', movie.id)
      }
    } catch (e) {
      console.error('[worker] Poll error for movie', movie.id, e.message)
    }
  }
}

async function main() {
  console.log('[worker] Starting ScriptFlow Worker (single Kling 3.0 architecture)...')
  console.log('[worker] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30))
  console.log('[worker] PIAPI key present:', !!process.env.PIAPI_API_KEY)

  while (true) {
    try {
      console.log('[worker] polling...')
      await pollMovies()
      console.log('[worker] poll complete')
    } catch (e) {
      console.error('[worker] FATAL ERROR:', e.message)
      console.error('[worker] Stack:', e.stack)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
}

main()
