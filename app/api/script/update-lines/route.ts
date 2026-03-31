import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const projectId: string = (body.projectId ?? '').trim()
    const editedLines: Array<{ character: string; text: string }> = body.lines ?? []

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 })
    }
    if (!Array.isArray(editedLines) || editedLines.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing lines' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Fetch current script_raw
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('script_raw')
      .eq('id', projectId)
      .single()

    if (fetchError || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const scriptRaw =
      typeof project.script_raw === 'string'
        ? JSON.parse(project.script_raw)
        : project.script_raw

    // Patch episodes[0].lines with edited text
    const episodes: any[] = scriptRaw?.structure?.episodes ?? []
    if (episodes.length > 0 && Array.isArray(episodes[0].lines)) {
      episodes[0].lines = editedLines.map((edited, i) => {
        const original = episodes[0].lines[i] ?? {}
        return { ...original, character: edited.character, text: edited.text }
      })
    }

    const updatedScriptRaw = JSON.stringify(scriptRaw)

    const { error: updateError } = await supabase
      .from('projects')
      .update({ script_raw: updatedScriptRaw })
      .eq('id', projectId)

    if (updateError) {
      console.error('[update-lines] update failed:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[update-lines]', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
