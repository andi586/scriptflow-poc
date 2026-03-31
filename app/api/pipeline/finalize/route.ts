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

/** Derive a Pixabay music genre keyword from the script's genre/mood field. */
function derivePixabayGenre(scriptRaw: any): string {
  const genre = (
    scriptRaw?.structure?.genre ??
    scriptRaw?.genre ??
    scriptRaw?.mood ??
    ''
  ).toLowerCase()
  if (/romance|love|drama/.test(genre)) return 'romantic'
  if (/action|fight|thriller/.test(genre)) return 'action'
  if (/comedy|funny|humor/.test(genre)) return 'happy'
  if (/horror|dark|mystery/.test(genre)) return 'dark'
  if (/fantasy|epic|adventure/.test(genre)) return 'epic'
  return 'cinematic'
}

/** Fetch a random BGM track URL from Pixabay music API. */
async function fetchPixabayBGM(genre: string = 'cinematic'): Promise<string | null> {
  const key = process.env.PIXABAY_API_KEY
  if (!key) return null
  const url = `https://pixabay.com/api/music/?key=${key}&q=${genre}&per_page=10`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json() as { hits?: Array<{ audio?: string; url?: string }> }
  const hits = data.hits
  if (!hits || hits.length === 0) return null
  const track = hits[Math.floor(Math.random() * hits.length)]
  return track.audio ?? track.url ?? null
}

/** Select BGM from Pixabay based on script genre, with fallback to 'cinematic'. */
async function selectBgmFromPixabay(scriptRaw: any): Promise<string | null> {
  const genre = derivePixabayGenre(scriptRaw)
  let bgm = await fetchPixabayBGM(genre)
  if (!bgm && genre !== 'cinematic') {
    bgm = await fetchPixabayBGM('cinematic')
  }
  return bgm
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId = body.projectId?.trim()
    if (!projectId) return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // 从 projects 表读取 script_raw 和 title
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('script_raw, title')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const scriptRaw = typeof project.script_raw === 'string'
      ? JSON.parse(project.script_raw)
      : project.script_raw

    // 查询 script_edits 表，将用户编辑的台词覆盖到 scriptRaw（Director Mode）
    const { data: scriptEdits } = await supabase
      .from('script_edits')
      .select('episode_index, line_index, edited_line')
      .eq('project_id', projectId)
      .eq('status', 'edited')
      .order('episode_index', { ascending: true })
      .order('line_index', { ascending: true })

    if (scriptEdits && scriptEdits.length > 0) {
      const episodes: any[] = scriptRaw?.structure?.episodes ?? []
      for (const edit of scriptEdits) {
        const ep = episodes[edit.episode_index]
        if (!ep || !Array.isArray(ep.lines)) continue
        const line = ep.lines[edit.line_index]
        if (!line) continue
        const editedText = edit.edited_line?.text ?? edit.edited_line
        if (typeof editedText === 'string') {
          ep.lines[edit.line_index] = { ...line, text: editedText }
        }
      }
      console.log(`[finalize] Applied ${scriptEdits.length} script_edits for project ${projectId}`)
    }

    // 获取 kling_tasks 按 scene_index 排序（用于 shot_id 映射）
    const { data: klingTasks, error: klingError } = await supabase
      .from('kling_tasks')
      .select('id, scene_index')
      .eq('project_id', projectId)
      .eq('status', 'success')
      .not('video_url', 'is', null)
      .order('scene_index', { ascending: true })

    if (klingError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch kling_tasks' }, { status: 500 })
    }

    // 解析对白块：structure.episodes[0].lines[]（容错：lines 不存在或为空则跳过）
    const episodes = scriptRaw?.structure?.episodes ?? []
    const firstEpisodeLines: Array<{ character: string; text: string }> = episodes[0]?.lines ?? []
    const hasDialogue = firstEpisodeLines.length > 0

    const dialogueBlocks: Array<{ shotIndex: number; role: string; text: string }> = []

    if (hasDialogue) {
      firstEpisodeLines.forEach((line: any, lineIndex: number) => {
        const role = (line.character ?? line.role ?? '').toLowerCase()
        const text = line.text ?? line.dialogue ?? ''
        if (role && text) {
          dialogueBlocks.push({ shotIndex: lineIndex, role, text })
        }
      })
    }

    // 写入 dialogue_blocks 表（仅当有对白时）
    if (dialogueBlocks.length > 0) {
      const { error: deleteError } = await supabase
        .from('dialogue_blocks')
        .delete()
        .eq('project_id', projectId)

      if (deleteError) {
        console.error('[finalize] Failed to delete old dialogue_blocks:', deleteError)
        return NextResponse.json({ success: false, error: 'Failed to clear old dialogue_blocks' }, { status: 500 })
      }

      const dialogueBlockRows = firstEpisodeLines.map((line: any, lineIndex: number) => {
        const shotId = klingTasks?.[lineIndex]?.id ?? null
        return {
          project_id: projectId,
          shot_id: shotId,
          character: line.character ?? line.role ?? '',
          text: line.text ?? line.dialogue ?? '',
          emotion: 'neutral',
        }
      }).filter((row: any) => row.character && row.text)

      const { error: insertError } = await supabase
        .from('dialogue_blocks')
        .insert(dialogueBlockRows)

      if (insertError) {
        console.error('[finalize] Failed to insert dialogue_blocks:', insertError)
        return NextResponse.json({ success: false, error: 'Failed to insert dialogue_blocks' }, { status: 500 })
      }

      console.log(`[finalize] Inserted ${dialogueBlockRows.length} dialogue_blocks for project ${projectId}`)
    } else {
      console.log(`[finalize] No dialogue lines found — skipping dialogue_blocks write for project ${projectId}`)
    }

    // 获取视频URLs
    const videoUrls = body.videoUrls?.length > 0
      ? body.videoUrls
      : await getCompletedVideoUrls(supabase, projectId)

    if (videoUrls.length === 0) {
      return NextResponse.json({ success: false, error: 'No completed video URLs' }, { status: 422 })
    }

    // 生成TTS配音（仅当有对白时）
    const audioList: Array<{ audioUrl: string; duration: number }> = []
    const srtChunks: string[] = []

    if (dialogueBlocks.length > 0) {
      let runningOffset = 0
      let srtSeq = 1

      for (const block of dialogueBlocks) {
        const voiceId = process.env[CHARACTER_VOICE_ENV_MAP[block.role]]
        console.error("[finalize] role=", block.role, "voiceId=", voiceId)
        if (!voiceId) throw new Error(`Missing voice ID for ${block.role}`)

        const apiKey = process.env.ELEVENLABS_API_KEY
        console.error("[finalize] apiKey prefix=", apiKey?.slice(0,8))
        const res = await fetch(`${ELEVENLABS_WITH_TIMESTAMPS_BASE_URL}/${voiceId}/with-timestamps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey! },
          body: JSON.stringify({ text: block.text, model_id: ELEVENLABS_MODEL_ID }),
        })

        const rawText = await res.text()
        console.error("[ElevenLabs raw text]", rawText.substring(0,300))
        const data = JSON.parse(rawText)
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
    } else {
      console.log(`[finalize] No dialogue — calling Railway merge with empty audio/srt for project ${projectId}`)
    }

    // 读取 episode 标题（用于片尾字幕卡）
    const episodeTitle: string = episodes[0]?.title ?? ''
    const projectTitle: string = (project as any).title ?? 'ScriptFlow'

    // 从 Pixabay 自动选 BGM
    let bgmUrl: string | null = null
    try {
      bgmUrl = await selectBgmFromPixabay(scriptRaw)
      if (bgmUrl) {
        console.log(`[finalize] BGM selected: ${bgmUrl}`)
      } else {
        console.log('[finalize] No BGM found from Pixabay — proceeding without BGM')
      }
    } catch (bgmErr) {
      console.warn('[finalize] BGM selection failed (skipping):', bgmErr instanceof Error ? bgmErr.message : bgmErr)
    }

    // 调用Railway合并（三轨：视频 + 对白音频 + BGM）
    const mergeRes = await fetch(RAILWAY_MERGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        videoUrls,
        audioUrls: audioList.map(a => a.audioUrl),
        srtContent: srtChunks.join('\n\n'),
        projectTitle,
        episodeNum: 1,
        episodeTitle,
        bgmUrl: bgmUrl ?? undefined,
      }),
    })

    const mergeData = await mergeRes.json()
    if (!mergeData.success || !mergeData.finalVideoUrl) {
      throw new Error(mergeData.error ?? 'Railway merge failed')
    }

    return NextResponse.json({
      success: true,
      finalVideoUrl: mergeData.finalVideoUrl,
      bgmUrl: bgmUrl ?? null,
      bgmApplied: !!bgmUrl,
    })

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
