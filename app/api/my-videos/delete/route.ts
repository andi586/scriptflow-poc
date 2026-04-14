import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/my-videos/delete
 * Body: { id: string }
 *
 * Deletes a row from omnihuman_jobs using the service role key.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
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
      .eq('id', id)

    if (error) {
      console.error('[my-videos/delete] Supabase delete error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[my-videos/delete] Deleted job:', id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[my-videos/delete] FATAL:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
