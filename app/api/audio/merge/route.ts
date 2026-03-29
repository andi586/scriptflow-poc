import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AudioTrack {
  url: string;
  startTime: number;
  duration?: number;
  volume?: number;
}

interface MergeRequest {
  projectId: string;
  tracks: AudioTrack[];
  outputDuration: number;
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url}`);
  }
  const buffer = await response.arrayBuffer();
  await writeFile(filepath, Buffer.from(buffer));
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('FFmpeg binary not found'));
      return;
    }

    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: MergeRequest = await request.json();
    const { projectId, tracks, outputDuration } = body;

    if (!projectId || !tracks || tracks.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create temp directory
    const tempDir = join(tmpdir(), `audio-merge-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    try {
      // Download all audio files
      const inputFiles: string[] = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const inputPath = join(tempDir, `input_${i}.mp3`);
        await downloadFile(track.url, inputPath);
        inputFiles.push(inputPath);
      }

      // Build FFmpeg filter complex
      const filterParts: string[] = [];
      const inputs: string[] = [];

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const volume = track.volume ?? 1.0;
        
        // Add delay and volume adjustment
        filterParts.push(
          `[${i}:a]adelay=${Math.round(track.startTime * 1000)}|${Math.round(track.startTime * 1000)},volume=${volume}[a${i}]`
        );
        inputs.push(`-i`);
        inputs.push(inputFiles[i]);
      }

      // Mix all tracks
      const mixInputs = tracks.map((_, i) => `[a${i}]`).join('');
      filterParts.push(`${mixInputs}amix=inputs=${tracks.length}:duration=longest[out]`);

      const filterComplex = filterParts.join(';');
      const outputPath = join(tempDir, 'output.mp3');

      // Run FFmpeg
      const ffmpegArgs = [
        ...inputs,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        '-t', outputDuration.toString(),
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-y',
        outputPath
      ];

      await runFFmpeg(ffmpegArgs);

      // Read output file
      const outputBuffer = await require('fs/promises').readFile(outputPath);

      // Upload to Supabase Storage
      const fileName = `${projectId}/audio-mix-${Date.now()}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-videos')
        .upload(fileName, outputBuffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('generated-videos')
        .getPublicUrl(fileName);

      // Save to audio_assets table
      const { data: asset, error: assetError } = await supabase
        .from('audio_assets')
        .insert({
          project_id: projectId,
          type: 'mix',
          name: `Audio Mix ${new Date().toISOString()}`,
          url: publicUrl,
          duration: outputDuration,
          metadata: {
            tracks: tracks.length,
            created_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (assetError) {
        console.error('Failed to save asset:', assetError);
      }

      // Cleanup temp files
      for (const file of inputFiles) {
        await unlink(file).catch(() => {});
      }
      await unlink(outputPath).catch(() => {});

      return NextResponse.json({
        success: true,
        url: publicUrl,
        assetId: asset?.id,
        duration: outputDuration
      });

    } finally {
      // Cleanup temp directory
      await unlink(tempDir).catch(() => {});
    }

  } catch (error) {
    console.error('Audio merge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to merge audio' },
      { status: 500 }
    );
  }
}
