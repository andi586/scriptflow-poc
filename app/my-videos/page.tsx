'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type VideoJob = {
  id: string
  result_video_url: string
  created_at: string
}

export default function MyVideosPage() {
  const [videos, setVideos] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const loadVideos = async () => {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('omnihuman_jobs')
        .select('id, result_video_url, created_at')
        .not('result_video_url', 'is', null)
        .order('created_at', { ascending: false })

      // Require login to view videos
      if (!user?.id) {
        setError('Please login to view your videos.')
        setLoading(false)
        return
      }

      // Filter by user_id
      const { data, error: err } = await query.eq('user_id', user.id)
      if (err) {
        setError(err.message)
      } else {
        setVideos((data ?? []) as VideoJob[])
      }
      setLoading(false)
    }

    void loadVideos()
  }, [])

  const handleDelete = async (id: string) => {
    const confirmed = confirm('Delete this video?')
    if (!confirmed) return

    setDeletingId(id)
    setError(null)

    try {
      const res = await fetch('/api/videos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Delete failed')
      } else {
        setVideos(prev => prev.filter(v => v.id !== id))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a
          href="/app-flow"
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          ← Back
        </a>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>🎬 My Videos</h1>
        <div style={{ width: '60px' }} />
      </div>

      {/* Content */}
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {error && (
          <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : videos.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎞️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem' }}>No videos yet.</p>
            <a
              href="/app-flow"
              style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.75rem 1.75rem', borderRadius: '9999px', background: '#7c3aed', color: 'white', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}
            >
              ✨ Create Your First Movie
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {videos.map(video => (
              <div
                key={video.id}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}
              >
                {/* Video player */}
                <video
                  src={video.result_video_url}
                  controls
                  playsInline
                  style={{ width: '100%', display: 'block', maxHeight: '320px', background: '#111', objectFit: 'contain' }}
                />

                {/* Meta + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                    {formatDate(video.created_at)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <a
                      href={video.result_video_url}
                      download
                      style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', background: 'rgba(124,58,237,0.7)', color: 'white', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600 }}
                    >
                      ⬇️ Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleDelete(video.id)}
                      disabled={deletingId === video.id}
                      style={{
                        padding: '0.4rem 0.9rem', borderRadius: '9999px',
                        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171', fontSize: '0.75rem', cursor: deletingId === video.id ? 'not-allowed' : 'pointer',
                        opacity: deletingId === video.id ? 0.5 : 1, fontWeight: 600,
                      }}
                    >
                      {deletingId === video.id ? '...' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
