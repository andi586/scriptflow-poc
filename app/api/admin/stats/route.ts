import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface StarDistribution { level: number; count: number }
export interface AdminStatsResponse {
  totalProjects: number; totalCreators: number; starDistribution: StarDistribution[]
  totalFundAwarded: number; pendingFundAmount: number; avgPotentialScore: number
  totalGeneratedAssets: number; platformGmv: number
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Service role key required' }, { status: 401 })
    }
    const [projectsRes, starsRes, fundsRes, scoresRes, assetsRes] = await Promise.all([
      supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('star_levels').select('star_level, creator_id'),
      supabaseAdmin.from('fund_awards').select('amount, status'),
      supabaseAdmin.from('potential_score_logs').select('potential_score'),
      supabaseAdmin.from('generated_assets').select('id', { count: 'exact', head: true }),
    ])
    const starMap = new Map()
    const creatorsSet = new Set()
    ;(starsRes.data || []).forEach((row: any) => {
      const level = Number(row.star_level)
      starMap.set(level, (starMap.get(level) ?? 0) + 1)
      if (row.creator_id) creatorsSet.add(row.creator_id)
    })
    const starDistribution: StarDistribution[] = Array.from(starMap.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => a.level - b.level)
    const funds = fundsRes.data || []
    let totalFundAwarded = 0; let pendingFundAmount = 0; let platformGmv = 0
    funds.forEach((f: any) => {
      const amount = Number(f.amount || 0)
      platformGmv += amount
      if (['awarded', 'paid', 'completed'].includes((f.status || '').toLowerCase())) totalFundAwarded += amount
      else if ((f.status || '').toLowerCase() === 'pending') pendingFundAmount += amount
    })
    const scores = scoresRes.data || []
    const avgPotentialScore = scores.length > 0
      ? scores.reduce((sum: number, s: any) => sum + Number(s.potential_score || 0), 0) / scores.length
      : 0
    const response: AdminStatsResponse = {
      totalProjects: projectsRes.count ?? 0,
      totalCreators: creatorsSet.size,
      starDistribution,
      totalFundAwarded: Number(totalFundAwarded.toFixed(2)),
      pendingFundAmount: Number(pendingFundAmount.toFixed(2)),
      avgPotentialScore: Number(avgPotentialScore.toFixed(2)),
      totalGeneratedAssets: assetsRes.count ?? 0,
      platformGmv: Number(platformGmv.toFixed(2)),
    }
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: process.env.NODE_ENV === 'development' ? error.message : '获取平台统计数据失败' }, { status: 500 })
  }
}
