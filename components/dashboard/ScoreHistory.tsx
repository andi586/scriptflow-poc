import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ScoreHistoryProps { history: { date: string; score: number }[] }

export function ScoreHistory({ history }: ScoreHistoryProps) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg text-white">QualityScore History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.slice(0, 5).map((entry, i) => (
          <div key={i} className="flex items-center p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-500 font-mono">
                  {new Date(entry.date).toLocaleDateString()}
                </span>
                <span className={`text-sm font-bold ${entry.score >= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  x{entry.score.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-zinc-500 text-sm text-center">No score history yet.</p>
        )}
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          Scores calculated per RSA Section 2 methodology.
        </p>
      </CardContent>
    </Card>
  )
}
