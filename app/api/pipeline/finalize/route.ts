import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

const CURATED_BGM_TRACKS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
]

function selectBgmFromPixabay(_scriptRaw: any): Promise<string | null> {
  const track = CURATED_BGM_TRACKS[Math.floor(Math.random() * CURATED_BGM_TRACKS.length)]
  console.log('[finalize] BGM selected (hardcoded):', track)
  return Promise.resolve(track)
}

/** Derive an ambient sound description from a scene prompt */
function deriveSceneEnvironment(sceneDescription: string): string {
  const s = (sceneDescription ?? '').toLowerCase()
  if (/office|work|desk|meeting/.test(s)) {
    return 'quiet office ambient, AC hum, distant keyboard clicks'
  }
  if (/hospital|medical|doctor/.test(s)) {
    return 'hospital corridor ambient, distant beeps, quiet footsteps'
  }
  if (/street|city|outdoor|road/.test(s)) {
    return 'urban outdoor ambient, distant traffic, city air'
  }
  if (/night|dark|quiet/.test(s)) {
    return 'quiet night ambient, gentle wind, distant crickets'
  }
  if (/fight|action|battle/.test(s)) {
    return 'tense ambient, low rumble, distant tension'
  }
  return 'soft indoor ambient, gentle room tone'
}

/** Call ElevenLabs Sound Effects API to generate ambience audio; returns public URL or null */
async function generateAmbienceForScene(prompt: string): Promise<string | null> {
  console.log('[ambience] calling ElevenLabs sound generation...')
  console.log('[ambience] prompt:', prompt)
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      console.error('[ambience] error: ELEVENLABS_API_KEY is not set')
      return null
    }

    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: 8,
        output_format: 'mp3_44100_128',
      }),
    })

    console.log('[ambience] response status:', res.status)

    if (!res.ok) {
      const errText = await res.text()
      console.error('[ambience] error:', `HTTP ${res.status} - ${errText.slice(0, 300)}`)
      console.log('[ambience] result url: FAILED')
      return null
    }

    // /v1/sound-generation returns binary MP3 stream (not JSON)
    let buffer: Buffer
    try {
      const arrayBuffer = await res.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
      console.log('[ambience] audio buffer size:', buffer.length, 'bytes')
    } catch (parseErr) {
      const parseError = parseErr instanceof Error ? parseErr : new Error(String(parseErr))
      console.error('[ambience] parse error:', parseError.message)
      console.log('[ambience] result url: FAILED')
      return null
    }
    if (buffer.length === 0) {
      console.error('[ambience] error: empty audio buffer from response')
      console.log('[ambience] result url: FAILED')
      return null
    }

    // Upload to Supabase storage and return public URL
    try {
      const supabase = getSupabaseAdminClient()
      const storagePath = `ambience/${Date.now()}-scene0.mp3`
      const bucket = process.env.GENERATED_AUDIO_BUCKET ?? 'generated-audio'

      console.log('[ambience] starting upload for role: scene0')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, { contentType: 'audio/mpeg', upsert: true })
      console.log('[ambience] upload result:', uploadData, uploadError)

      if (uploadError) {
        console.error('[ambience] upload error:', uploadError)
        console.log('[ambience] result url: FAILED')
        return null
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      console.log('[ambience] result url:', data.publicUrl)
      return data.publicUrl
    } catch (uploadErr) {
      console.error('[ambience] upload error:', uploadErr instanceof Error ? uploadErr.message : uploadErr)
      console.log('[ambience] result url: FAILED')
      return null
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ambience] error:', msg)
    console.log('[ambience] result url: FAILED')
    return null
  }
}

export async function POST(request: NextRequest) {
  console.log('[finalize] ENTER v2', new Date().toISOString())
  try {
    const body = await request.json()
    const projectId = body.projectId?.trim()
    if (!projectId) return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // 从 projects 表读取 script_raw、title、episode_number、is_star_mode 和 language
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('script_raw, title, episode_number, status, is_star_mode, language')
      .eq('id', projectId)
      .single()

    console.log('[finalize] project fields:', JSON.stringify({
      id: projectId,
      title: project?.title,
      episode_number: (project as any)?.episode_number,
      is_star_mode: (project as any)?.is_star_mode,
      has_script_raw: !!(project as any)?.script_raw,
    }))

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

    // ── Debug: dump script_raw structure to trace dialogueBlocks source ──────
    console.log('[finalize] script_raw structure:', JSON.stringify(scriptRaw).slice(0, 500))

    // 解析对白块：多格式兼容
    // 格式1: structure.episodes[0].lines[] — F81 v2 / Director Mode
    // 格式2: structure.scenes[].shots[] — NEL 原始格式
    // 格式3: structure.scenes[] — 场景描述转旁白
    const episodes = scriptRaw?.structure?.episodes ?? []
    let firstEpisodeLines: Array<{ character: string; text: string }> = episodes[0]?.lines ?? []

    // 格式2/3 兼容：如果 episodes[0].lines 为空，尝试从 scenes 提取
    if (firstEpisodeLines.length === 0) {
      const scenes: any[] = scriptRaw?.structure?.scenes ?? []
      if (scenes.length > 0) {
        console.log('[finalize] episodes[0].lines empty — falling back to scenes[] format')
        // 格式2: scenes[].shots[] 有对白
        const fromShots: Array<{ character: string; text: string }> = []
        for (const scene of scenes) {
          const shots: any[] = scene.shots ?? []
          for (const shot of shots) {
            const character = shot.character ?? shot.role ?? 'narrator'
            const text = shot.dialogue ?? shot.text ?? shot.description ?? ''
            if (text) fromShots.push({ character, text })
          }
        }
        if (fromShots.length > 0) {
          firstEpisodeLines = fromShots
          console.log('[finalize] Extracted', fromShots.length, 'lines from scenes[].shots[]')
        } else {
          // 格式3: scenes[] 本身有 description/summary → 转成旁白行
          const fromScenes: Array<{ character: string; text: string }> = scenes
            .map((scene: any) => {
              const text = scene.description ?? scene.summary ?? scene.title ?? ''
              return text ? { character: 'narrator', text } : null
            })
            .filter(Boolean) as Array<{ character: string; text: string }>
          if (fromScenes.length > 0) {
            firstEpisodeLines = fromScenes
            console.log('[finalize] Extracted', fromScenes.length, 'narrator lines from scenes[].description')
          }
        }
      }
    }

    const hasDialogue = firstEpisodeLines.length > 0
    console.log('[finalize] hasDialogue:', hasDialogue, '| lines count:', firstEpisodeLines.length)
    console.log('[finalize] firstEpisodeLines sample:', JSON.stringify(firstEpisodeLines.slice(0, 2)))

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

    // 读取用户语言（用于 ElevenLabs language_code 和 FFmpeg 字幕字体）
    // 默认 'en'；Star Mode 从输入检测；Director Mode 从 projects.language 读取
    const userLanguage: string = ((project as any).language ?? 'en').toLowerCase().split('-')[0]
    console.log('[finalize] userLanguage:', userLanguage)
    console.log('[finalize] project.language raw value:', (project as any).language)

    // ── Debug: dump script_raw structure to trace dialogueBlocks source ──────
    console.log('[finalize] scriptRaw keys:', scriptRaw ? Object.keys(scriptRaw) : 'null')
    console.log('[finalize] scriptRaw.structure keys:', scriptRaw?.structure ? Object.keys(scriptRaw.structure) : 'null')
    console.log('[finalize] episodes count:', (scriptRaw?.structure?.episodes ?? []).length)
    const _ep0 = (scriptRaw?.structure?.episodes ?? [])[0]
    console.log('[finalize] episode[0] keys:', _ep0 ? Object.keys(_ep0) : 'null')
    console.log('[finalize] episode[0].lines count:', Array.isArray(_ep0?.lines) ? _ep0.lines.length : 'no lines array')
    console.log('[finalize] episode[0].lines sample:', JSON.stringify((_ep0?.lines ?? []).slice(0, 2)))

    // ── Step 3: Claude back-translation ──────────────────────────────────────
    // If userLanguage is not English, translate dialogue lines back to user language
    // before TTS so voice and subtitles are in the user's native language.
    async function translateDialogueToUserLanguage(
      blocks: Array<{ shotIndex: number; role: string; text: string }>,
      targetLang: string
    ): Promise<Array<{ shotIndex: number; role: string; text: string }>> {
      if (targetLang === 'en' || blocks.length === 0) return blocks
      const LANG_NAMES: Record<string, string> = {
        zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean',
        es: 'Spanish', fr: 'French', ar: 'Arabic', hi: 'Hindi',
        pt: 'Portuguese', de: 'German', it: 'Italian', ru: 'Russian',
        th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
      }
      const langName = LANG_NAMES[targetLang] ?? targetLang
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      if (!anthropicKey) {
        console.warn('[finalize] No ANTHROPIC_API_KEY — skipping back-translation')
        return blocks
      }
      try {
        const linesJson = JSON.stringify(blocks.map(b => ({ role: b.role, text: b.text })))
        const prompt = `You are a professional drama script translator. Translate the following dialogue lines from English to ${langName}.

Rules:
- Preserve emotional intensity and dramatic tension
- Use natural, colloquial speech (not formal/literary)
- Keep character names unchanged
- Return ONLY a JSON array with the same structure: [{"role":"...","text":"..."}]
- No explanations, no markdown, just the JSON array

Dialogue to translate:
${linesJson}`

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
        if (!res.ok) {
          console.warn('[finalize] Claude translation HTTP error:', res.status)
          return blocks
        }
        const data = await res.json() as any
        const translated = JSON.parse(data.content?.[0]?.text ?? '[]') as Array<{ role: string; text: string }>
        if (!Array.isArray(translated) || translated.length !== blocks.length) {
          console.warn('[finalize] Claude translation returned unexpected shape — using original')
          return blocks
        }
        console.log(`[finalize] Back-translated ${blocks.length} lines to ${langName}`)
        return blocks.map((b, i) => ({ ...b, text: translated[i]?.text ?? b.text }))
      } catch (e) {
        console.warn('[finalize] Claude back-translation failed (using original):', e instanceof Error ? e.message : e)
        return blocks
      }
    }

    // 生成TTS配音（仅当有对白时）
    const audioList: Array<{ audioUrl: string; duration: number }> = []
    const srtChunks: string[] = []

    if (dialogueBlocks.length > 0) {
      // Back-translate dialogue to user language before TTS
      const translatedBlocks = await translateDialogueToUserLanguage(dialogueBlocks, userLanguage)

      let runningOffset = 0
      let srtSeq = 1

      for (const block of translatedBlocks) {
        const voiceId = process.env[CHARACTER_VOICE_ENV_MAP[block.role]]
        console.error("[finalize] role=", block.role, "voiceId=", voiceId)
        if (!voiceId) {
          console.warn(`[finalize] No voice ID for "${block.role}" — skipping TTS`)
          continue
        }

        const apiKey = process.env.ELEVENLABS_API_KEY
        console.error("[finalize] apiKey prefix=", apiKey?.slice(0,8))
        // Pass language_code to ElevenLabs for multilingual TTS
        const ttsBody: Record<string, any> = { text: block.text, model_id: ELEVENLABS_MODEL_ID }
        if (userLanguage !== 'en') {
          ttsBody.language_code = userLanguage
        }
        const res = await fetch(`${ELEVENLABS_WITH_TIMESTAMPS_BASE_URL}/${voiceId}/with-timestamps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey! },
          body: JSON.stringify(ttsBody),
        })

        const rawText = await res.text()
        console.log('[elevenlabs] raw response:', rawText.slice(0, 500))
        const data = JSON.parse(rawText)
        console.log('[elevenlabs] parsed keys:', Object.keys(data))
        console.log('[elevenlabs] http status:', res.status)

        // Handle API errors (e.g. quota_exceeded, invalid_api_key, etc.)
        if (!res.ok || data.detail) {
          const errDetail = typeof data.detail === 'object'
            ? JSON.stringify(data.detail)
            : String(data.detail ?? `HTTP ${res.status}`)
          throw new Error(`ElevenLabs API error: ${errDetail}`)
        }

        // audio_base64 is at the top level per ElevenLabs with-timestamps API
        const audioBase64 = data.audio_base64
        if (!audioBase64) {
          console.error('[elevenlabs] full response:', JSON.stringify(data).slice(0, 1000))
          throw new Error(`ElevenLabs missing audio_base64 — keys found: ${Object.keys(data).join(', ')}`)
        }

        const audioBuffer = Buffer.from(audioBase64, 'base64')
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

    console.log('[finalize] TTS loop done, proceeding to ambience...')

    // 读取 episode 标题（用于片尾字幕卡）
    const episodeTitle: string = episodes[0]?.title ?? ''
    const projectTitle: string = (project as any).title ?? 'ScriptFlow'

    // 生成第一个场景的环境音（在TTS完成后、BGM选曲前）
    let ambienceUrl: string | null = null
    try {
      const firstSceneDesc = episodes[0]?.summary ?? episodes[0]?.title ?? ''
      const ambiencePrompt = deriveSceneEnvironment(firstSceneDesc)
      console.log('[finalize] Generating ambience for scene 0:', ambiencePrompt)
      console.log('[ambience] ===== ABOUT TO CALL AMBIENCE =====')
      ambienceUrl = await generateAmbienceForScene(ambiencePrompt)
      if (ambienceUrl) {
        console.log('[finalize] Ambience URL:', ambienceUrl)
      } else {
        console.log('[finalize] Ambience generation skipped or failed — proceeding without ambience')
      }
    } catch (ambErr) {
      console.warn('[finalize] Ambience generation error (skipping):', ambErr instanceof Error ? ambErr.message : ambErr)
    }

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

    // 读取 episode_number（null = 无系列编号，不显示片头）
    // Star Mode 项目 episode_number 为 null，Director Mode 可以有值
    const episodeNum: number | null = (project as any).episode_number ?? null

    // 读取 series_name（用户自定义系列名，Director Mode 专用）
    const seriesName: string | null = (project as any).series_name ?? null

    // 检测是否为 Star Mode 项目（Star Mode 不添加片头集数字幕）
    const isStarMode: boolean = !!(project as any).is_star_mode

    // 调用Railway合并（四轨：视频 + 对白音频 + BGM + 环境音）
    const mergeBody = {
      projectId,
      videoUrls,
      audioUrls: audioList.map(a => a.audioUrl),
      srtContent: srtChunks.join('\n\n'),
      projectTitle,
      episodeNum,   // null = no title card; number = show episode title card
      episodeTitle,
      seriesName,   // user-defined series name (Director Mode only)
      bgmUrl: bgmUrl ?? undefined,
      ambienceUrl: ambienceUrl ?? undefined,
      isStarMode,
      userLanguage, // ISO 639-1 code for subtitle font selection
    }
    console.log('[finalize] about to call Railway, ambienceUrl=', ambienceUrl)
    console.log('[railway-request] url:', RAILWAY_MERGE_URL)
    console.log('[railway-request] body:', JSON.stringify(mergeBody, null, 2))

    const mergeRes = await fetch(RAILWAY_MERGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergeBody),
    })

    const mergeData = await mergeRes.json()
    console.log('[railway-response]', JSON.stringify(mergeData, null, 2))
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
    console.error('[pipeline/finalize] catch triggered:', error instanceof Error ? error.message : error)
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
