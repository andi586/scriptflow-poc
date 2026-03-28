'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, RefreshCcw, Zap, BarChart3, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HtsDimension { name: string; score: number; weight: number }
interface HtsApiResponse { total: number; passed: boolean; dimensions: HtsDimension[]; suggestions: string[] }
interface HtsScoreCardProps { text: string; type: 'prompt' | 'script'; autoScore?: boolean }

export function HtsScoreCard({ text, type, autoScore = false }: HtsScoreCardProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HtsApiResponse | null>(null)

  const fetchScore = async () => {
    if (!text) return
    setLoading(true)
    try {
      const response = await fetch('/api/hts/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type }),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('HTS Scoring Error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (autoScore) fetchScore() }, [autoScore])

  if (loading) return (
    <Card className="bg-zinc-950 border-zinc-800 p-6 space-y-8">
      <div className="flex justify-between"><Skeleton className="h-6 w-32 bg-zinc-900" /><Skeleton className="h-6 w-20 bg-zinc-900" /></div>
      <div className="flex flex-col items-center py-4"><Skeleton className="h-16 w-24 bg-zinc-900" /><Skeleton className="h-4 w-32 mt-4 bg-zinc-900" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-zinc-900" />)}</div>
    </Card>
  )

  if (!result) return (
    <Card className="bg-zinc-900 border-dashed border-zinc-800 flex flex-col items-center justify-center p-12 text-center">
      <BarChart3 className="h-12 w-12 text-zinc-700 mb-4" />
      <p className="text-zinc-500 mb-6">No analysis data available for this {type}.</p>
      <Button onClick={fetchScore} className="bg-purple-600 hover:bg-purple-700">Run HTS Analysis</Button>
    </Card>
  )

  return (
    <Card className="bg-zinc-950 border-zinc-800 overflow-hidden shadow-2xl">
      <CardHeader className="border-b border-zinc-900 bg-zinc-900/30">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg font-bold tracking-tight uppercase">HTS Analysis Report</CardTitle>
          </div>
          <Badge className={cn('px-3 py-1', result.passed ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20')}>
            {result.passed ? 'PASSED' : 'REVISION REQUIRED'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        <div className="flex flex-col items-center py-4">
          <div className={cn('text-7xl font-black mb-2', result.total >= 6 ? 'text-emerald-500' : 'text-red-500')}>
            {result.total.toFixed(1)}
          </div>
          <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Production Potential Score</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {result.dimensions.map(dim => (
            <div key={dim.name} className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-semibold">{dim.name}</span>
                <span className="text-zinc-500">Weight: {Math.round(dim.weight * 100)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', dim.score >= 6 ? 'bg-purple-500' : 'bg-zinc-600')}
                    style={{ width: `${dim.score * 10}%` }} />
                </div>
                <span className="text-sm font-mono w-8 text-right">{dim.score}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-300">
            <Lightbulb className="h-4 w-4 text-purple-400" />
            Optimization Suggestions
          </div>
          <ul className="grid grid-cols-1 gap-2">
            {result.suggestions.map((s, i) => (
              <li key={i} className="text-sm text-zinc-400 flex gap-2 items-start bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />{s}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="bg-zinc-900/20 p-4 border-t border-zinc-900">
        <Button variant="ghost" onClick={fetchScore} className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800">
          <RefreshCcw className="mr-2 h-4 w-4" /> Re-scan Content
        </Button>
      </CardFooter>
    </Card>
  )
}
