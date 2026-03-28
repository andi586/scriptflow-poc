'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartProps { data: { month: string; amount: number }[] }

export function EarningsChart({ data }: ChartProps) {
  const maxAmount = Math.max(...data.map(d => d.amount), 1)
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Monthly Performance</CardTitle>
      </CardHeader>
      <CardContent className="h-64 flex items-end gap-2 pt-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full bg-purple-900/40 border-t-2 border-purple-500 hover:bg-purple-600 transition-all rounded-t-sm"
              style={{ height: `${(item.amount / maxAmount) * 100}%` }}
            />
            <span className="text-[10px] text-zinc-500 mt-2">{item.month}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
