import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface MonthlyEarnings { month: string; amount: number }
export interface QualityScoreHistory { date: string; score: number }
export interface DiscoveryFundAward { period: string; amount: number; status: string }
export interface EarningsDashboardResponse {
  currentStarLevel: number
  totalEarnings: number
  monthlyEarnings: MonthlyEarnings[]
  qualityScoreHistory: QualityScoreHistory[]
  latestPotentialScore: number
  discoveryFundAwards: DiscoveryFundAward[]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const [starResult, fundAwardsResult, scoreLogsResult] = await Promise.all([
      supabase
        .from('star_levels')
        .select('star_level')
        .eq('creator_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('fund_awards')
        .select('award_period, amount, status')
        .eq('creator_id', userId)
        .order('award_period', { ascending: false }),
      supabase
        .from('potential_score_logs')
        .select('calculated_at, potential_score')
        .eq('creator_id', userId)
        .order('calculated_at', { ascending: false }),
    ])

    const currentStarLevel = (starResult.data as any)?.star_level ?? 1

    const rawAwards = fundAwardsResult.data ?? []
    const discoveryFundAwards: DiscoveryFundAward[] = rawAwards.map((award: any) => ({
      period: award.award_period,
      amount: Number(award.amount),
      status: award.status,
    }))

    const totalEarnings = rawAwards.reduce((sum: number, award: any) => sum + Number(award.amount || 0), 0)

    const monthlyMap = new Map<string, number>()
    rawAwards.forEach((award: any) => {
      const month = award.award_period
      const amount = Number(award.amount || 0)
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amount)
    })
    const monthlyEarnings: MonthlyEarnings[] = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month))

    const rawScoreLogs = scoreLogsResult.data ?? []
    const latestPotentialScore = rawScoreLogs.length > 0 ? Number((rawScoreLogs[0] as any).potential_score) : 0
    const qualityScoreHistory: QualityScoreHistory[] = rawScoreLogs.map((log: any) => ({
      date: log.calculated_at,
      score: Number(log.potential_score),
    }))

    const response: EarningsDashboardResponse = {
      currentStarLevel,
      totalEarnings: Number(totalEarnings.toFixed(2)),
      monthlyEarnings,
      qualityScoreHistory,
      latestPotentialScore: Number(latestPotentialScore.toFixed(2)),
      discoveryFundAwards,
    }
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
