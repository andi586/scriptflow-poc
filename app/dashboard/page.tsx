'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface MovieShot {
  id: string
  movie_id: string
  shot_index: number
  shot_type: string
  status: string
  final_shot_url: string | null
  created_at: string
}

interface MovieGroup {
  movieId: string
  shots: MovieShot[]
  total: number
  completed: number
  progress: number
  latestStatus: string
}

interface OmniJob {
  id: string
  task_id: string
  status: string
  result_video_url: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  scene_only: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  processing: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  omni_done: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  kling_done: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  shot_complete: 'bg-green-500/20 text-green-300 border-green-500/30',
  movie_complete: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  rendering: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  kling_processing: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono ${cls}`}>
      {status}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? 'bg-emerald-500' : value > 50 ? 'bg-blue-500' : 'bg-yellow-500'
  return (
    <div className="w-full bg-white/10 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export default function MonitoringDashboard() {
  const [movieGroups, setMovieGroups] = useState<MovieGroup[]>([])
  const [omniJobs, setOmniJobs] = useState<OmniJob[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Fetch active movie_shots (not movie_complete)
      const { data: shots } = await supabase
        .from('movie_shots')
        .select('id, movie_id, shot_index, shot_type, status, final_shot_url, created_at')
        .not('status', 'eq', 'movie_complete')
        .order('created_at', { ascending: false })
        .limit(200)

      if (shots) {
        const groups: Record<string, MovieShot[]> = {}
        for (const shot of shots) {
          if (!groups[shot.movie_id]) groups[shot.movie_id] = []
          groups[shot.movie_id].push(shot)
        }

        const grouped: MovieGroup[] = Object.entries(groups).map(([movieId, shotList]) => {
          const sorted = [...shotList].sort((a, b) => a.shot_index - b.shot_index)
          const completed = sorted.filter(s => s.status === 'shot_complete').length
          const total = sorted.length
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0
          const latestStatus = sorted[0]?.status ?? 'unknown'
          return { movieId, shots: sorted, total, completed, progress, latestStatus }
        })

        // Sort: in-progress first, then by most recent
        grouped.sort((a, b) => {
          if (a.progress === 100 && b.progress !== 100) return 1
          if (b.progress === 100 && a.progress !== 100) return -1
          return 0
        })

        setMovieGroups(grouped)
      }

      // Fetch recent omnihuman_jobs
      const { data: jobs } = await supabase
        .from('omnihuman_jobs')
        .select('id, task_id, status, result_video_url, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (jobs) setOmniJobs(jobs)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('[dashboard] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  const activeMovies = movieGroups.filter(m => m.progress < 100)
  const completedMovies = movieGroups.filter(m => m.progress === 100)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">🎬 ScriptFlow Monitor</h1>
          <p className="text-white/40 text-sm mt-1">Real-time pipeline dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            Auto-refresh every 10s
          </div>
          <span className="text-xs text-white/30">
            Last: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-white/40">Loading...</div>
      ) : (
        <div className="space-y-8">
          {/* ── Active Movies ── */}
          <section>
            <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
              Active Movies ({activeMovies.length})
            </h2>
            {activeMovies.length === 0 ? (
              <div className="bg-white/5 rounded-xl p-6 text-center text-white/30 text-sm">
                No active movies
              </div>
            ) : (
              <div className="space-y-4">
                {activeMovies.map(movie => (
                  <div key={movie.movieId} className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-mono text-xs text-white/40 mb-1">movie_id</p>
                        <p className="font-mono text-sm text-white/80 break-all">{movie.movieId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{movie.progress}%</p>
                        <p className="text-xs text-white/40">{movie.completed}/{movie.total} shots</p>
                      </div>
                    </div>
                    <ProgressBar value={movie.progress} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {movie.shots.map(shot => (
                        <div key={shot.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                          <span className="text-xs text-white/40 font-mono">#{shot.shot_index}</span>
                          <span className="text-xs text-white/50">{shot.shot_type}</span>
                          <StatusBadge status={shot.status} />
                          {shot.final_shot_url && (
                            <a
                              href={shot.final_shot_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              ▶
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Completed Movies ── */}
          {completedMovies.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Completed Movies ({completedMovies.length})
              </h2>
              <div className="space-y-3">
                {completedMovies.map(movie => (
                  <div key={movie.movieId} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                    <p className="font-mono text-xs text-white/50 break-all">{movie.movieId}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">{movie.total} shots</span>
                      <StatusBadge status="shot_complete" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Recent OmniHuman Jobs ── */}
          <section>
            <h2 className="text-lg font-semibold text-white/80 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Recent OmniHuman Jobs (last 10)
            </h2>
            {omniJobs.length === 0 ? (
              <div className="bg-white/5 rounded-xl p-6 text-center text-white/30 text-sm">
                No jobs found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs border-b border-white/10">
                      <th className="text-left pb-2 pr-4">Task ID</th>
                      <th className="text-left pb-2 pr-4">Status</th>
                      <th className="text-left pb-2 pr-4">Created</th>
                      <th className="text-left pb-2">Video</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {omniJobs.map(job => (
                      <tr key={job.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-4 font-mono text-xs text-white/50 max-w-[200px] truncate">
                          {job.task_id}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-2 pr-4 text-xs text-white/40">
                          {new Date(job.created_at).toLocaleString()}
                        </td>
                        <td className="py-2">
                          {job.result_video_url ? (
                            <a
                              href={job.result_video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                              ▶ Preview
                            </a>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
