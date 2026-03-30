import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ELEVENLABS_WITH_TIMESTAMPS_BASE_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
const RAILWAY_MERGE_URL = process.env.VIDEO_MERGE_SERVICE_URL + '/merge'

const MIN_SHOT_DURATION_SECONDS = 4.5
const MAX_SHOT_DURATION_SECONDS = 8.0
const SHOT_LEAD_IN_SECONDS = 0.35
const SHOT_TAIL_OUT_SECONDS = 0.45
const GENERATED_AUDIO_BUCKET = process.env.GENERATED_AUDIO_BUCKET ?? 'generated-audio'
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2'

const CHARACTER_VOICE_ENV_MAP: Record<string, string> = {
  caius: 'ELEVENLABS_VOICE_ID_CAIUS',
  luna: 'ELEVENLABS_VOICE_ID_LUNA',
  marcus: 'ELEVENLABS_VOICE_ID_MARCUS',
  narrator: 'ELEVENLABS_VOICE_ID_NARRATOR',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = body.projectId?.trim()
    if (!projectId) return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // 从 projects 表读取 script_raw
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('script_raw')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const scriptRaw = typeof project.script_raw === 'string'
      ? JSON.parse(project.script_raw)
      : project.script_raw

    // 解析对白块：structure.episodes[].lines[]
    const dialogueBlocks: Array<{ shotIndex: number; role: string; text: string }> = []
    const episodes = scriptRaw?.structure?.episodes ?? []
    episodes.forEach((ep: any, epIndex: number) => {
      const lines = ep.lines ?? []
      lines.forEach((line: any, lineIndex: number) => {
        const role = (line.character ?? line.role ?? '').toLowerCase()
        const text = line.text ?? line.dialogue ?? ''
        if (role && text && ['caius', 'luna', 'marcus'].includes(role)) {
          dialogueBlocks.push({ shotIndex: epIndex, role, text })
        }
      })
    })

    if (dialogueBlocks.length === 0) {
      return NextResponse.json({ success: false, error: 'No dialogue blocks found' }, { status: 422 })
    }

    // 获取视频URLs
    const videoUrls = body.videoUrls?.length > 0
      ? body.videoUrls
      : await getCompletedVideoUrls(supabase, projectId)

    if (videoUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'No completed video URLs' }, { status: 422 })
    }

    // 生成TTS配音
    const audioList = []
    let runningOffset = 0
    const srtChunks: string[] = []
    let srtSeq = 1

    for (const block of dialogueBlocks) {
      const voiceId = process.env[CHARACTER_VOICE_ENV_MAP[block.role]]
      if (!voiceId) throw new Error(`Missing voice ID for ${block.role}`)

      const apiKey = process.env.ELEVENLABS_API_KEY
      const res = await fetch(`${ELEVENLABS_WITH_TIMESTAMPS_BASE_URL}/${voiceId}/with-timestamps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey! },
        body: JSON.stringify({ text: block.text, model_id: ELEVENLABS_MODEL_ID }),
      })

      const data = await res.json()
      console.error("[ElevenLabs raw]", JSON.stringify(data).substring(0,200))
      if (!data.audio_base64) throw new Error('ElevenLabs missing audio_base64')

      const audioBuffer = Buffer.from(data.audio_base64, 'base64')
      const alignment = data.normalized_alignment ?? data.alignment
      const duration = Math.max(0, ...alignment.character_end_times_seconds)

      const storagePath = `${projectId}/dialogue-audio/${String(audioList.length + 1).padStart(3, '0')}-${block.role}.mp3`
      await supabase.storage.from(GENERATED_AUDIO_BUCKET).upload(storagePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
      const { data: urlData } = supabase.storage.from(GENERATED_AUDIO_BUCKET).getPublicUrl(storagePath)

      audioList.push({ audioUrl: urlData.publicUrl, duration })

      // 生成SRT
      srtChunks.push(`${srtSeq}\n${formatSrtTime(runningOffset)} --> ${formatSrtTime(runningOffset + duration)}\n${block.text}`)
      srtSeq++
      runningOffset += duration
    }

    // 调用Railway合并
    const mergeRes = await fetch(RAILWAY_MERGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        videoUrls,
        audioUrls: audioList.map(a => a.audioUrl),
        srtContent: srtChunks.join('\n\n'),
      }),
    })

    const mergeData = await mergeRes.json()
    if (!mergeData.success || !mergeData.finalVideoUrl) {
      throw new Error(mergeData.error ?? 'Railway merge failed')
    }

    return NextResponse.json({ success: true, finalVideoUrl: mergeData.finalVideoUrl })

  } catch (error) {
    console.error('[pipeline/finalize]', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function getCompletedVideoUrls(supabase: SupabaseClient, projectId: string): Promise<string[]> {
  const { data } = await supabase
    .from('kling_tasks')
    .select('video_url, scene_index, created_at')
    .eq('project_id', projectId)
    .eq('status', 'success')
    .not('video_url', 'is', null)

  return (data ?? [])
    .sort((a, b) => (a.scene_index ?? 0) - (b.scene_index ?? 0))
    .map(r => r.video_url as string)
}

function formatSrtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000)
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const msRem = ms % 1000
  return `${pad(h,2)}:${pad(m,2)}:${pad(s,2)},${pad(msRem,3)}`
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0')
}
