import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
type ProjectStatus = 'draft' | 'processing' | 'completed' | 'failed'
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
type AssetStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'failed'

type ShotRow = {
  id: string
  project_id: string
  shot_index: number
  kling_prompt: string
  kling_task_id: string | null
  video_url: string | null
  video_status: AssetStatus
}

type ElevenLabsTimestamps = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

type DialogueLineRow = {
  id: string
  project_id: string
  shot_index: number
  line_index: number
  character: string
  text: string
  emotion: string | null
  voice_id: string
  audio_url: string | null
  tts_status: AssetStatus
  start_sec: number | null
  duration_sec: number | null
  timestamps_json: ElevenLabsTimestamps | null
}

type GenerationRunRow = {
  project_id: string
  video_status: JobStatus
  tts_status: JobStatus
  merge_status: JobStatus
  started_at: string | null
  merge_started_at: string | null
  completed_at: string | null
}

type ProjectRow = {
  id: string
  status: ProjectStatus
  final_video_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type TtsResult = {
  lineId: string
  audioUrl: string
  durationSec: number
  timestamps: ElevenLabsTimestamps
}

type MergeDialogueLine = {
  audioUrl: string
  startSec: number
  character: string
}

type MergeDialogueTimelineItem = {
  shotIndex: number
  lines: MergeDialogueLine[]
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) return `https://${vercelUrl}`
  return 'http://localhost:3000'
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed: ${response.status} - ${text}`)
  }
  return (await response.json()) as T
}

function getFirstSpokenOffsetSec(ts: ElevenLabsTimestamps): number {
  for (let i = 0; i < ts.characters.length; i++) {
    if (ts.characters[i].trim() !== '') return ts.character_start_times_seconds[i] ?? 0
  }
  return 0
}

function getLastSpokenOffsetSec(ts: ElevenLabsTimestamps): number {
  for (let i = ts.characters.length - 1; i >= 0; i--) {
    if (ts.characters[i].trim() !== '') return ts.character_end_times_seconds[i] ?? 0
  }
  return 0
}

function buildStartSecondsForShot(
  lines: Array<{ id: string; audioUrl: string; character: string; timestamps: ElevenLabsTimestamps }>,
  leadInSec = 0.35,
  gapSec = 0.22
): Array<{ id: string; startSec: number }> {
  let cursor = leadInSec
  return lines.map((line) => {
    const firstSpokenOffsetSec = getFirstSpokenOffsetSec(line.timestamps)
    const lastSpokenOffsetSec = getLastSpokenOffsetSec(line.timestamps)
    const startSec = Math.max(0, cursor - firstSpokenOffsetSec)
    const spokenEndSec = startSec + lastSpokenOffsetSec
    cursor = spokenEndSec + gapSec
    return { id: line.id, startSec: Number(startSec.toFixed(3)) }
  })
}

async function updateProject(supabase: SupabaseClient, projectId: string, patch: Partial<ProjectRow>): Promise<void> {
  const { error } = await supabase.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', projectId)
  if (error) throw new Error(error.message)
}

async function updateRun(supabase: SupabaseClient, projectId: string, patch: Partial<GenerationRunRow>): Promise<void> {
  const { error } = await supabase.from('generation_runs').update(patch).eq('project_id', projectId)
  if (error) throw new Error(error.message)
}

async function ensureRunRow(supabase: SupabaseClient, projectId: string): Promise<void> {
  const { error } = await supabase.from('generation_runs').upsert(
    { project_id: projectId, video_status: 'pending', tts_status: 'pending', merge_status: 'pending', started_at: new Date().toISOString() },
    { onConflict: 'project_id' }
  )
  if (error) throw new Error(error.message)
}

function buildDialogueTimeline(dialogueLines: DialogueLineRow[]): MergeDialogueTimelineItem[] {
  const grouped = new Map<number, DialogueLineRow[]>()
  for (const line of dialogueLines) {
    const bucket = grouped.get(line.shot_index) ?? []
    bucket.push(line)
    grouped.set(line.shot_index, bucket)
  }
  return [...grouped.keys()].sort((a, b) => a - b).map((shotIndex) => ({
    shotIndex,
    lines: (grouped.get(shotIndex) ?? [])
      .filter((l) => l.audio_url && typeof l.start_sec === 'number')
      .sort((a, b) => (a.start_sec ?? 0) - (b.start_sec ?? 0))
      .map((l) => ({ audioUrl: l.audio_url as string, startSec: l.start_sec as number, character: l.character })),
  }))
}

export async function startEpisodeOrchestration(projectId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const [{ data: shots }, { data: dialogueLines }] = await Promise.all([
    supabase.from('shots').select('*').eq('project_id', projectId).order('shot_index').returns<ShotRow[]>(),
    supabase.from('dialogue_lines').select('*').eq('project_id', projectId).order('shot_index').order('line_index').returns<DialogueLineRow[]>(),
  ])

  if (!shots || shots.length === 0) throw new Error(`No shots found for project ${projectId}`)

  await ensureRunRow(supabase, projectId)
  await updateProject(supabase, projectId, { status: 'processing', error_message: null })
  await updateRun(supabase, projectId, { video_status: 'processing', tts_status: 'processing', merge_status: 'pending' })

  const baseUrl = getBaseUrl()

  const [klingResult, ttsResult] = await Promise.all([
    fetchJson<{ success: boolean; tasks: { shotId: string; taskId: string }[] }>(`${baseUrl}/api/video/kling/submit`, {
      method: 'POST',
      body: JSON.stringify({ projectId, shots: shots.map((s) => ({ shotId: s.id, shotIndex: s.shot_index, prompt: s.kling_prompt })) }),
    }),
    fetchJson<{ success: boolean; results: TtsResult[] }>(`${baseUrl}/api/audio/tts`, {
      method: 'POST',
      body: JSON.stringify({ projectId, items: (dialogueLines ?? []).map((l) => ({ lineId: l.id, shotIndex: l.shot_index, lineIndex: l.line_index, character: l.character, text: l.text, emotion: l.emotion, voiceId: l.voice_id })), withTimestamps: true }),
    }),
  ])

  for (const task of klingResult.tasks) {
    await supabase.from('shots').update({ kling_task_id: task.taskId, video_status: 'submitted' }).eq('id', task.shotId)
  }

  const lineMap = new Map<string, TtsResult>()
  for (const r of ttsResult.results) lineMap.set(r.lineId, r)

  const byShot = new Map<number, Array<{ id: string; audioUrl: string; character: string; timestamps: ElevenLabsTimestamps }>>()
  for (const line of dialogueLines ?? []) {
    const result = lineMap.get(line.id)
    if (!result) continue
    const bucket = byShot.get(line.shot_index) ?? []
    bucket.push({ id: line.id, audioUrl: result.audioUrl, character: line.character, timestamps: result.timestamps })
    byShot.set(line.shot_index, bucket)
  }

  for (const [, lines] of byShot.entries()) {
    const starts = buildStartSecondsForShot(lines)
    for (const line of lines) {
      const result = lineMap.get(line.id)
      const computed = starts.find((s) => s.id === line.id)
      if (!result || !computed) continue
      await supabase.from('dialogue_lines').update({
        audio_url: result.audioUrl, duration_sec: result.durationSec,
        timestamps_json: result.timestamps as unknown as Json,
        start_sec: computed.startSec, tts_status: 'completed',
      }).eq('id', line.id)
    }
  }

  await updateRun(supabase, projectId, { tts_status: 'completed' })
}

export async function progressEpisodeOrchestration(projectId?: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const baseUrl = getBaseUrl()

  let query = supabase.from('generation_runs').select('*')
    .or('video_status.eq.processing,merge_status.eq.pending')
  if (projectId) query = query.eq('project_id', projectId)

  const { data: runs } = await query.returns<GenerationRunRow[]>()

  for (const run of runs ?? []) {
    try {
      if (run.video_status === 'processing') {
        const { data: shots } = await supabase.from('shots').select('*').eq('project_id', run.project_id).returns<ShotRow[]>()
        const poll = await fetchJson<{ success: boolean; tasks: { shotId: string; status: string; videoUrl?: string }[] }>(`${baseUrl}/api/video/kling/poll`, {
          method: 'POST',
          body: JSON.stringify({ shots: (shots ?? []).filter((s) => s.kling_task_id).map((s) => ({ shotId: s.id, taskId: s.kling_task_id })) }),
        })

        let allCompleted = true
        for (const task of poll.tasks) {
          await supabase.from('shots').update({ video_status: task.status, ...(task.videoUrl ? { video_url: task.videoUrl } : {}) }).eq('id', task.shotId)
          if (task.status !== 'completed') allCompleted = false
        }
        if (allCompleted) await updateRun(supabase, run.project_id, { video_status: 'completed' })
      }

      const { data: freshRun } = await supabase.from('generation_runs').select('*').eq('project_id', run.project_id).single<GenerationRunRow>()
      if (!freshRun) continue

      if (freshRun.video_status === 'completed' && freshRun.tts_status === 'completed' && freshRun.merge_status === 'pending') {
        await updateRun(supabase, run.project_id, { merge_status: 'processing', merge_started_at: new Date().toISOString() })

        const { data: shots } = await supabase.from('shots').select('*').eq('project_id', run.project_id).order('shot_index').returns<ShotRow[]>()
        const { data: dialogueLines } = await supabase.from('dialogue_lines').select('*').eq('project_id', run.project_id).order('shot_index').order('line_index').returns<DialogueLineRow[]>()

        const shotVideoUrls = (shots ?? []).map((s) => s.video_url).filter((u): u is string => Boolean(u))
        const dialogueTimeline = buildDialogueTimeline(dialogueLines ?? [])

        const merge = await fetchJson<{ success: boolean; url: string }>(`${baseUrl}/api/audio/merge`, {
          method: 'POST',
          body: JSON.stringify({ projectId: run.project_id, shotVideoUrls, dialogueTimeline }),
        })

        await updateRun(supabase, run.project_id, { merge_status: 'completed', completed_at: new Date().toISOString() })
        await updateProject(supabase, run.project_id, { status: 'completed', final_video_url: merge.url, error_message: null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      await updateProject(supabase, run.project_id, { status: 'failed', error_message: message })
    }
  }
}
