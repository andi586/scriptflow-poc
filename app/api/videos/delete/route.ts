import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/videos/delete
 * Body: { jobId: string }
 *
 * Deletes a row from omnihuman_jobs using the service role key.
 */
export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { error } = await supabaseAdmin
      .from('omnihuman_jobs')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error('[videos/delete] Supabase delete error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[videos/delete] Deleted job:', jobId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[videos/delete] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
