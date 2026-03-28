import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'

export function StarLevelBadge({ level }: { level: number }) {
  const isLegendary = level === 5
  const labels = ['Rookie', 'Rising', 'Pro', 'Master', 'Legendary']
  return (
    <Badge className={`px-3 py-1 flex items-center gap-1 font-bold ${
      isLegendary
        ? 'bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]'
        : 'bg-zinc-800 text-zinc-300'
    }`}>
      <Star className="h-3 w-3 fill-current" />
      {labels[(level - 1)] || 'Creator'}
    </Badge>
  )
}
