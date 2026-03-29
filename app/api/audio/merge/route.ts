import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ffmpegStatic from 'ffmpeg-static'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function getFfmpegPath(): string {
  return (ffmpegStatic as string) || 'ffmpeg'
}

async function downloadToFile(url: string, outPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(outPath, buf)
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg failed (${code}): ${stderr.slice(-500)}`))
    })
  })
}

export async function POST(req: NextRequest) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sf-merge-'))
  try {
    const body = await req.json()
    const { projectId, shotVideoUrls, audioUrls, srtContent, bgMusicUrl } = body

    if (!projectId) return NextResponse.json({ success: false, error: 'projectId required' }, { status: 400 })
    if (!Array.isArray(shotVideoUrls) || shotVideoUrls.length === 0) return NextResponse.json({ success: false, error: 'shotVideoUrls required' }, { status: 400 })
    if (!Array.isArray(audioUrls) || audioUrls.length === 0) return NextResponse.json({ success: false, error: 'audioUrls required' }, { status: 400 })

    // Download videos
    const videoPaths: string[] = []
    for (let i = 0; i < shotVideoUrls.length; i++) {
      const vp = path.join(workDir, `v${i}.mp4`)
      await downloadToFile(shotVideoUrls[i], vp)
      videoPaths.push(vp)
    }

    // Download audios
    const audioPaths: string[] = []
    for (let i = 0; i < audioUrls.length; i++) {
      const ap = path.join(workDir, `a${i}.mp3`)
      await downloadToFile(audioUrls[i], ap)
      audioPaths.push(ap)
    }

    // Concat videos
    const listFile = path.join(workDir, 'list.txt')
    await fs.writeFile(listFile, videoPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
    const concatVideo = path.join(workDir, 'concat.mp4')
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', concatVideo])

    // Concat audios
    const audioListFile = path.join(workDir, 'alist.txt')
    await fs.writeFile(audioListFile, audioPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
    const concatAudio = path.join(workDir, 'audio.m4a')
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', audioListFile, '-c', 'aac', '-b:a', '192k', concatAudio])

    // Write SRT
    let srtPath: string | undefined
    if (srtContent?.trim()) {
      srtPath = path.join(workDir, 'sub.srt')
      await fs.writeFile(srtPath, srtContent, 'utf8')
    }

    // Final merge
    const finalPath = path.join(workDir, 'final.mp4')
    const ffArgs = ['-y', '-i', concatVideo, '-i', concatAudio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '192k', '-shortest']

    if (srtPath) {
      const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
      ffArgs.push('-vf', `subtitles='${escaped}'`)
    }

    ffArgs.push(finalPath)
    await runFfmpeg(ffArgs)

    // Upload to Supabase
    const supabase = getSupabaseAdmin()
    const storagePath = `episodes/${projectId}/final-${Date.now()}.mp4`
    const fileBuffer = await fs.readFile(finalPath)

    const { error: uploadError } = await supabase.storage
      .from('generated-videos')
      .upload(storagePath, fileBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data } = supabase.storage.from('generated-videos').getPublicUrl(storagePath)
    const mergedVideoUrl = data.publicUrl

    return NextResponse.json({ success: true, mergedVideoUrl, url: mergedVideoUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
