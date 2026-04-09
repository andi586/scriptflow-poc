import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Generic file upload to Supabase Storage
 *
 * POST /api/upload
 * FormData: { file: Blob, bucket?: string, folder?: string }
 * Returns: { url: string }
 */
export async function POST(request: NextRequest) {
  console.log('[upload] ENTER', new Date().toISOString())

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[upload] Supabase env vars missing')
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const formData = await request.formData()
    const file     = formData.get('file') as File | null
    const bucket   = (formData.get('bucket') as string | null) ?? 'recordings'
    const folder   = (formData.get('folder') as string | null) ?? 'tmp'

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const ext      = file.type.includes('webm') ? 'webm'
                   : file.type.includes('mp4')  ? 'mp4'
                   : file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg'
                   : file.type.includes('png')  ? 'png'
                   : 'bin'
    const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    console.log('[upload] uploading to', bucket, filename, 'size:', file.size, 'type:', file.type)

    const arrayBuffer = await file.arrayBuffer()
    const buffer      = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      console.error('[upload] Supabase upload error:', uploadError.message, '| bucket:', bucket, '| file:', filename)
      // If bucket doesn't exist, give a clear message
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
        console.error('[upload] HINT: Create bucket "recordings" in Supabase Storage with public access')
      }
      return NextResponse.json({ error: uploadError.message, hint: 'Check Supabase Storage bucket exists and is public' }, { status: 500 })
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filename)
    const publicUrl = publicData.publicUrl

    console.log('[upload] success, publicUrl:', publicUrl)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[upload] FATAL:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
