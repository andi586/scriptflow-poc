'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Movie = {
  id: string
  status: string
  final_video_url: string | null
  created_at: string
}

export default function MyVideosPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const loadMovies = async () => {
      const { data, error: err } = await supabase
        .from('movies')
        .select('id, status, final_video_url, created_at')
        .order('created_at', { ascending: false })
        .limit(20)

      if (err) {
        setError(err.message)
      } else {
        setMovies((data ?? []) as Movie[])
      }
      setLoading(false)
    }

    void loadMovies()
  }, [])

  const handleDelete = async (id: string) => {
    setConfirmId(null)
    setDeletingId(id)
    setError(null)

    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('movies').delete().eq('id', id)
      if (err) {
        setError(err.message)
      } else {
        setMovies(prev => prev.filter(m => m.id !== id))
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

  const statusLabel = (status: string) => {
    if (status === 'thinking') return { text: '🎬 Director is planning...', color: '#a855f7' }
    if (status === 'processing') return { text: '🎥 Generating...', color: '#f59e0b' }
    if (status === 'complete') return { text: '✅ Ready', color: '#22c55e' }
    return { text: status, color: '#888' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a
          href="/create"
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
        ) : movies.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎞️</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem' }}>No videos yet.</p>
            <a
              href="/create"
              style={{ display: 'inline-block', marginTop: '1.5rem', padding: '0.75rem 1.75rem', borderRadius: '9999px', background: '#7c3aed', color: 'white', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}
            >
              ✨ Create Your First Movie
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {movies.map(movie => {
              const sl = statusLabel(movie.status)
              return (
                <div
                  key={movie.id}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', overflow: 'hidden' }}
                >
                  {/* Video player or placeholder */}
                  {movie.final_video_url ? (
                    <video
                      src={movie.final_video_url}
                      controls
                      playsInline
                      style={{ width: '100%', display: 'block', maxHeight: '320px', background: '#111', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '180px', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <div style={{ fontSize: '2rem' }}>🎬</div>
                      <p style={{ color: sl.color, fontSize: '0.85rem', margin: 0 }}>{sl.text}</p>
                    </div>
                  )}

                  {/* iOS save instruction */}
                  {movie.final_video_url && (
                    <p style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center', margin: '0.25rem 0 0' }}>
                      Opens in new tab → long press → Save to Photos
                    </p>
                  )}

                  {/* Meta + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: sl.color, fontSize: '0.75rem', fontWeight: 600 }}>{sl.text}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>{formatDate(movie.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <a
                        href={`/movie/${movie.id}`}
                        style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', background: 'rgba(124,58,237,0.7)', color: 'white', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600 }}
                      >
                        👁 View
                      </a>
                      {movie.final_video_url && (
                        <button
                          onClick={() => window.open(movie.final_video_url!, '_blank')}
                          style={{ padding: '0.4rem 0.9rem', borderRadius: '9999px', background: '#D4A853', border: 'none', color: '#000', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                          📱 Open Video to Save
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(movie.id)}
                        disabled={deletingId === movie.id}
                        style={{
                          padding: '0.4rem 0.9rem', borderRadius: '9999px',
                          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                          color: '#f87171', fontSize: '0.75rem', cursor: deletingId === movie.id ? 'not-allowed' : 'pointer',
                          opacity: deletingId === movie.id ? 0.5 : 1, fontWeight: 600,
                        }}
                      >
                        {deletingId === movie.id ? '...' : '🗑 Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
