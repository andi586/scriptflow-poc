'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COSTS = {
  omniHuman: 0.04,
  kling: 0.10,
  elevenLabs: 0.02,
  shotstack: 0.20
}

export default function Dashboard() {
  const [movies, setMovies] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = async () => {
    // Get all movie_shots grouped by movie_id
    const { data: shots } = await supabase
      .from('movie_shots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    // Get recent omnihuman_jobs
    const { data: jobData } = await supabase
      .from('omnihuman_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (shots) {
      // Group by movie_id
      const grouped: Record<string, any[]> = {}
      for (const shot of shots) {
        if (!grouped[shot.movie_id]) grouped[shot.movie_id] = []
        grouped[shot.movie_id].push(shot)
      }
      setMovies(Object.entries(grouped).map(([id, s]) => ({ id, shots: s })))
    }
    if (jobData) setJobs(jobData)
    setLastRefresh(new Date())
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const calcMovieCost = (shots: any[]) => {
    const faceCount = shots.filter(s => s.shot_type === 'face').length
    const totalShots = shots.length
    const duration = shots.reduce((sum, s) => sum + (s.duration ?? 10), 0)
    return (
      faceCount * COSTS.omniHuman +
      totalShots * COSTS.kling +
      faceCount * COSTS.elevenLabs +
      (duration / 60) * COSTS.shotstack
    ).toFixed(2)
  }

  const todayMovies = movies.filter(m => {
    const created = new Date(m.shots[0]?.created_at)
    const today = new Date()
    return created.toDateString() === today.toDateString()
  })

  const todayCost = todayMovies.reduce((sum, m) => sum + parseFloat(calcMovieCost(m.shots)), 0).toFixed(2)
  const avgCost = todayMovies.length > 0 ? (parseFloat(todayCost) / todayMovies.length).toFixed(2) : '0.00'

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#666',
      submitted: '#4a9eff',
      processing: '#f59e0b',
      merging: '#f97316',
      done: '#10b981',
      final_complete: '#8b5cf6',
      failed: '#ef4444',
      // legacy aliases
      scene_only: '#4a9eff',
      omni_done: '#f59e0b',
      kling_done: '#f59e0b',
      shot_complete: '#10b981',
      movie_complete: '#8b5cf6',
    }
    return colors[status] ?? '#666'
  }

  const activeMovies = movies.filter(m => {
    const completeCount = m.shots.filter((s: any) =>
      s.status === 'shot_complete' || s.status === 'final_complete'
    ).length
    return completeCount < m.shots.length
  })
  const completedMovies = jobs.filter(j => j.result_video_url)

  const MONTHLY_COSTS = {
    piapi: { name: 'PiAPI (Kling+OmniHuman)', monthly: null, perUnit: '$0.04-0.10/task', color: '#4a9eff' },
    elevenlabs: { name: 'ElevenLabs', monthly: '$22/mo (Creator)', perUnit: '$0.02/TTS', color: '#10b981' },
    shotstack: { name: 'Shotstack', monthly: '$39/mo', perUnit: '$0.20/min', color: '#f59e0b' },
    railway: { name: 'Railway (FFmpeg)', monthly: '$5/mo', perUnit: 'included', color: '#8b5cf6' },
    supabase: { name: 'Supabase', monthly: '$25/mo', perUnit: 'included', color: '#06b6d4' },
    vercel: { name: 'Vercel', monthly: '$20/mo', perUnit: 'included', color: '#a78bfa' },
    anthropic: { name: 'Anthropic (Claude)', monthly: null, perUnit: '$0.001/script', color: '#10b981' },
  }

  const fixedMonthly = 111
  const variablePerVideo = 1.31
  const pricePerVideo = 9.99
  const breakEven = Math.ceil(fixedMonthly / (pricePerVideo - variablePerVideo))

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', padding: '24px', fontFamily: 'monospace', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a78bfa' }}>🎬 ScriptFlow Dashboard</h1>
        <span style={{ color: '#666', fontSize: '0.8rem' }}>Auto-refresh 10s | Last: {lastRefresh.toLocaleTimeString()}</span>
      </div>

      {/* Cost Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px', overflowX: 'hidden' }}>
        {[
          { label: "Today's Cost", value: `$${todayCost}`, color: parseFloat(todayCost) > 5 ? '#ef4444' : parseFloat(todayCost) > 2 ? '#f59e0b' : '#10b981' },
          { label: 'Videos Today', value: todayMovies.length, color: '#a78bfa' },
          { label: 'Avg Per Video', value: `$${avgCost}`, color: '#4a9eff' },
          { label: 'Active Now', value: activeMovies.length, color: '#f59e0b' },
        ].map((card, i) => (
          <div key={i} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', border: '1px solid #333', overflowX: 'hidden', wordBreak: 'break-word' }}>
            <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '8px' }}>{card.label}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* API Services Cost Monitor */}
      <h2 style={{ color: '#06b6d4', marginBottom: '16px' }}>🔌 API Services Status & Cost</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px', overflowX: 'hidden' }}>
        {Object.values(MONTHLY_COSTS).map((svc, i) => (
          <div key={i} style={{ background: '#1a1a1a', borderRadius: '10px', padding: '14px', border: '1px solid #333', overflowX: 'hidden', wordBreak: 'break-word' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: svc.color, flexShrink: 0 }} />
              <span style={{ color: '#ccc', fontSize: '0.75rem', fontWeight: 'bold' }}>{svc.name}</span>
            </div>
            <div style={{ color: svc.monthly ? '#fff' : '#666', fontSize: '0.8rem', marginBottom: '4px' }}>
              {svc.monthly ?? 'Pay-as-you-go'}
            </div>
            <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>{svc.perUnit}</div>
            <div style={{ fontSize: '0.7rem' }}>
              <span style={{ color: '#10b981' }}>✅ Active</span>
            </div>
          </div>
        ))}
      </div>
      {/* Break-even summary */}
      <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', marginBottom: '32px', border: '1px solid #333', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Fixed Monthly Overhead</div>
          <div style={{ color: '#ef4444', fontSize: '1.4rem', fontWeight: 'bold' }}>${fixedMonthly}/mo</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Variable Cost / Video</div>
          <div style={{ color: '#f59e0b', fontSize: '1.4rem', fontWeight: 'bold' }}>${variablePerVideo}</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Price / Video</div>
          <div style={{ color: '#4a9eff', fontSize: '1.4rem', fontWeight: 'bold' }}>${pricePerVideo}</div>
        </div>
        <div style={{ borderLeft: '1px solid #333', paddingLeft: '32px' }}>
          <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>Break-even</div>
          <div style={{ color: '#10b981', fontSize: '1.8rem', fontWeight: 'bold' }}>{breakEven} videos/month</div>
          <div style={{ color: '#666', fontSize: '0.7rem' }}>${fixedMonthly} ÷ (${pricePerVideo} − ${variablePerVideo}) = {breakEven} videos</div>
        </div>
      </div>

      {/* Active Movies */}
      <h2 style={{ color: '#f59e0b', marginBottom: '16px' }}>⚡ Active Movies ({activeMovies.length})</h2>
      {activeMovies.length === 0 && <div style={{ color: '#666', marginBottom: '24px' }}>No active movies</div>}
      {activeMovies.map(movie => {
        const complete = movie.shots.filter((s: any) => s.status === 'shot_complete' || s.status === 'final_complete').length
        const total = movie.shots.length
        const pct = Math.round((complete / total) * 100)
        const cost = calcMovieCost(movie.shots)
        const costColor = parseFloat(cost) > 2 ? '#ef4444' : parseFloat(cost) > 1 ? '#f59e0b' : '#10b981'
        return (
          <div key={movie.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>🎬 {movie.id.slice(0, 8)}...</span>
              <span style={{ color: costColor, fontSize: '0.85rem' }}>Est. ${cost}</span>
            </div>
            {/* Progress bar */}
            <div style={{ background: '#333', borderRadius: '4px', height: '8px', marginBottom: '12px' }}>
              <div style={{ background: '#10b981', height: '8px', borderRadius: '4px', width: `${pct}%`, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {movie.shots.sort((a: any, b: any) => a.shot_index - b.shot_index).map((shot: any) => (
                <div key={shot.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2a2a2a', padding: '4px 8px', borderRadius: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(shot.status) }} />
                  <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{shot.shot_type === 'face' ? '👤' : '🎬'}{shot.shot_index}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '8px', color: '#666', fontSize: '0.75rem' }}>{complete}/{total} shots complete ({pct}%)</div>
          </div>
        )
      })}

      {/* Completed Videos */}
      <h2 style={{ color: '#10b981', marginBottom: '16px', marginTop: '32px' }}>✅ Recent Completed ({completedMovies.length})</h2>
      {completedMovies.slice(0, 10).map(job => (
        <div key={job.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#a78bfa', fontSize: '0.8rem', marginBottom: '4px' }}>{job.task_id?.slice(0, 16)}...</div>
            <div style={{ color: '#666', fontSize: '0.75rem' }}>{new Date(job.created_at).toLocaleString()}</div>
          </div>
          {job.result_video_url && (
            <a href={job.result_video_url} target="_blank" rel="noreferrer"
              style={{ background: '#7c3aed', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', textDecoration: 'none' }}>
              ▶ Watch
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
