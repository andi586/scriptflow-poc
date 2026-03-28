'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EarningsChart } from '@/components/dashboard/EarningsChart'
import { StarLevelBadge } from '@/components/dashboard/StarLevelBadge'
import { ScoreHistory } from '@/components/dashboard/ScoreHistory'
import { Loader2, Award } from 'lucide-react'

interface EarningsData {
  currentStarLevel: number
  totalEarnings: number
  monthlyEarnings: { month: string; amount: number }[]
  qualityScoreHistory: { date: string; score: number }[]
  latestPotentialScore: number
  discoveryFundAwards: { period: string; amount: number; status: string }[]
}

export default function EarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/earnings')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <Loader2 className="animate-spin text-purple-500" />
    </div>
  )
  if (!data) return <div className="p-8 text-white">Error loading earnings data.</div>

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 text-zinc-100 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings Center</h1>
          <p className="text-zinc-400 text-sm">ScriptFlow Creator Economy</p>
        </div>
        <div className="flex items-center gap-4">
          <StarLevelBadge level={data.currentStarLevel} />
          <Button className="bg-purple-600 hover:bg-purple-700 text-white">
            <Award className="mr-2 h-4 w-4" /> Discovery Fund
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${data.totalEarnings.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Latest Potential Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{data.latestPotentialScore}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Fund Awards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{data.discoveryFundAwards.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarningsChart data={data.monthlyEarnings} />
        <ScoreHistory history={data.qualityScoreHistory} />
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg text-white">Discovery Fund History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.discoveryFundAwards.length === 0 && (
              <p className="text-zinc-500 text-sm text-center">No awards yet.</p>
            )}
            {data.discoveryFundAwards.map((award, i) => (
              <div key={i} className="flex justify-between items-center border-b border-zinc-800 pb-2">
                <div>
                  <p className="font-semibold text-purple-300">+${award.amount} USD</p>
                  <p className="text-xs text-zinc-500">{award.status}</p>
                </div>
                <span className="text-xs text-zinc-400">{award.period}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
