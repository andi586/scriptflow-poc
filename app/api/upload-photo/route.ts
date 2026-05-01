import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    console.log('[upload-photo] Uploading file:', file.name, 'size:', file.size, 'type:', file.type)
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `uploads/${Date.now()}_${file.name}`
    
    const { error } = await supabase.storage
      .from('recordings')
      .upload(fileName, buffer, { 
        contentType: file.type, 
        upsert: true 
      })
    
    if (error) {
      console.error('[upload-photo] Upload error:', error)
      throw error
    }
    
    const { data } = supabase.storage
      .from('recordings')
      .getPublicUrl(fileName)
    
    console.log('[upload-photo] Upload successful:', data.publicUrl)
    
    return NextResponse.json({ url: data.publicUrl })
  } catch (err: any) {
    console.error('[upload-photo] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
