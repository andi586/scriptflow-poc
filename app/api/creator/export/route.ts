import { NextResponse } from 'next/server'
import { exportCreatorIPBundle } from '@/lib/creator-sovereignty'
import { createClient } from '@/lib/supabase/server'

type ExportBundleResult = unknown

function buildFilename(userId: string): string {
  return `scriptflow-ip-bundle-${userId}.json`
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    let bundle: ExportBundleResult
    try {
      bundle = await exportCreatorIPBundle(user.id)
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Failed to export creator IP bundle'
      return NextResponse.json({ error: 'Export failed', details: message }, { status: 500 })
    }
    const filename = buildFilename(user.id)
    const body = JSON.stringify(bundle, null, 2)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
