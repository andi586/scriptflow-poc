'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Video, DollarSign, ShieldAlert, BarChart3, TrendingUp, Layers, HeartHandshake } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminStats {
  totalProjects: number
  totalCreators: number
  totalGeneratedAssets: number
  platformGmv: number
  starDistribution: { level: number; count: number }[]
  totalFundAwarded: number
  pendingFundAmount: number
  avgPotentialScore: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` }
    })
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 space-y-8">
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
        <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Restricted Area: ScriptFlow Internal Administration Only</p>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">System Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time ecosystem health and compliance monitoring.</p>
        </div>
        <Badge variant="outline" className="border-purple-500/50 text-purple-400 px-4 py-1">Protocol v4.0 Active</Badge>
      </div>
      {loading ? <AdminSkeleton /> : stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Projects" value={stats.totalProjects} icon={<Layers />} />
            <StatCard title="Total Creators" value={stats.totalCreators} icon={<Users />} />
            <StatCard title="Generated Assets" value={stats.totalGeneratedAssets} icon={<Video />} />
            <StatCard title="Platform GMV" value={`$${stats.platformGmv.toLocaleString()}`} icon={<DollarSign />} highlight />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-500" />Creator Star Distribution</CardTitle>
                <CardDescription>Population across TrustScore tiers</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-end gap-4 pt-6">
                {stats.starDistribution.map(item => {
                  const maxCount = Math.max(...stats.starDistribution.map(s => s.count), 1)
                  return (
                    <div key={item.level} className="flex-1 flex flex-col items-center group">
                      <div className="w-full bg-purple-600/20 border-t-2 border-purple-500 hover:bg-purple-600/40 transition-all rounded-t-md relative"
                        style={{ height: `${(item.count / maxCount) * 100}%` }}>
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                      </div>
                      <span className="text-xs text-zinc-500 mt-3">{item.level}★</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-purple-400" />Discovery Fund Status</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">Disbursed</p>
                    <p className="text-2xl font-bold text-emerald-500">${stats.totalFundAwarded.toLocaleString()}</p>
                  </div>
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 uppercase">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-500">${stats.pendingFundAmount.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-zinc-900 border-zinc-800 border-l-4 border-l-purple-600">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-purple-400" />Avg. Potential Score</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-4xl font-black text-purple-500">{stats.avgPotentialScore.toFixed(2)}</div>
                  <p className="text-[10px] text-zinc-600 mt-2 italic">Calculated across all generated content</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, highlight = false }: { title: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn('bg-zinc-900 border-zinc-800', highlight && 'border-purple-500/30 bg-purple-500/5')}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="p-3 bg-zinc-950 rounded-lg text-purple-500 border border-zinc-800">{icon}</div>
      </CardContent>
    </Card>
  )
}

function AdminSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-zinc-900 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 bg-zinc-900 rounded-xl" />
    </div>
  )
}
