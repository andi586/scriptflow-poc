import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { entriesToSrt, timestampsToSubtitleEntries } from '@/lib/subtitle/generate-srt'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const VOICE_MAP: Record<string, string> = {
  luna: '21m00Tcm4TlvDq8ikWAM',
  caius: 'TxGEqnHWrfWFTfGW9XjX',
  marcus: 'EXAVITQu4vr4xnSDxMaL',
  narrator: 'pNInz6obpgDQGcFmaJgB',
}

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://getscriptflow.com'
  try {
    const { projectId } = await req.json()
    if (!projectId) return NextResponse.json({ success: false, error: 'projectId required' }, { status: 400 })

    await supabase.from('projects').update({ generation_status: 'generating_audio' }).eq('id', projectId)

    const { data: project } = await supabase.from('projects').select('script_raw').eq('id', projectId).single()
    if (!project?.script_raw) return NextResponse.json({ success: false, error: 'No script_raw' }, { status: 400 })

    const scriptRaw = JSON.parse(project.script_raw)
    const episodes = scriptRaw?.structure?.episodes || []
    const segments = episodes.map((ep: any, i: number) => {
      const lines = ep.lines || []
      const text = lines.map((l: any) => l.text).join(' ') || ep.summary || ''
      const character = lines[0]?.character || 'narrator'
      return { shotIndex: i, text: text.trim(), character, voiceId: VOICE_MAP[character] || VOICE_MAP.narrator }
    }).filter((s: any) => s.text.length > 0)

    const ttsRes = await fetch(`${baseUrl}/api/audio/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, segments }),
    })
    const ttsData = await ttsRes.json()
    if (!ttsData.success) return NextResponse.json({ success: false, error: `TTS failed: ${ttsData.error}` }, { status: 500 })

    await supabase.from('projects').update({ generation_status: 'generating_subtitle' }).eq('id', projectId)

    let allEntries: any[] = []
    let nextIndex = 1, offsetSeconds = 0
    for (const item of ttsData.items || []) {
      if (item.timestamps) {
        const entries = timestampsToSubtitleEntries(item.timestamps, { offsetSeconds, startIndex: nextIndex })
        allEntries.push(...entries)
        nextIndex += entries.length
        offsetSeconds += item.durationSeconds || 0
      }
    }
    const srtContent = entriesToSrt(allEntries)
    await supabase.from('projects').update({ srt_content: srtContent, subtitle_generated_at: new Date().toISOString() }).eq('id', projectId)

    const { data: tasks } = await supabase.from('kling_tasks').select('video_url, scene_number').eq('project_id', projectId).eq('status', 'success').order('scene_number')
    if (!tasks?.length) return NextResponse.json({ success: false, error: 'No completed videos' }, { status: 400 })

    const shotVideoUrls = tasks.map((t: any) => t.video_url).filter(Boolean)
    const audioUrls = (ttsData.items || []).map((i: any) => i.audioUrl)

    await supabase.from('projects').update({ generation_status: 'merging' }).eq('id', projectId)

    const mergeRes = await fetch(`${baseUrl}/api/audio/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, shotVideoUrls, audioUrls, srtContent }),
    })
    const mergeData = await mergeRes.json()
    if (!mergeData.success) return NextResponse.json({ success: false, error: `Merge failed: ${mergeData.error}` }, { status: 500 })

    const finalVideoUrl = mergeData.mergedVideoUrl || mergeData.url
    await supabase.from('projects').update({ final_video_url: finalVideoUrl, generation_status: 'completed' }).eq('id', projectId)

    return NextResponse.json({ success: true, finalVideoUrl })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
