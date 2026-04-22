'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function MoviePage() {
  const [movie, setMovie] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [movieId, setMovieId] = useState<string | null>(null)

  useEffect(() => {
    const id = window.location.pathname.split('/').pop()
    console.log('[movie page] id from URL:', id)
    setMovieId(id || null)
  }, [])

  useEffect(() => {
    if (!movieId) return

    const fetchMovie = async () => {
      const { data } = await supabase
        .from('movies')
        .select('*')
        .eq('id', movieId)
        .single()
      console.log('[movie page] data:', data)
      setMovie(data)
      setLoading(false)
    }

    fetchMovie()

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('movies')
        .select('*')
        .eq('id', movieId)
        .single()
      if (data?.final_video_url) {
        setMovie(data)
        clearInterval(interval)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [movieId])

  if (loading || !movie?.final_video_url) return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white'}}>
      <div style={{fontSize:'3rem',marginBottom:'24px'}}>🎬</div>
      <h2 style={{color:'#D4A853',marginBottom:'12px'}}>Creating your movie...</h2>
      <p style={{color:'#888'}}>This takes 2-5 minutes</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{marginTop:'32px',width:'40px',height:'40px',border:'3px solid #D4A853',borderTop:'3px solid transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
    </div>
  )

  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px 120px',color:'white',fontFamily:'system-ui'}}>
      <h1 style={{color:'#D4A853',fontSize:'1.5rem',marginBottom:'4px'}}>Your Movie is Ready! 🎬</h1>
      <p style={{color:'#555',fontSize:'0.85rem',marginBottom:'32px'}}>Share it with the world</p>

      <div style={{position:'relative',display:'inline-block',marginBottom:'32px'}}>
        <video
          src={movie.final_video_url}
          controls
          autoPlay
          playsInline
          style={{maxHeight:'70vh',maxWidth:'360px',borderRadius:'16px',boxShadow:'0 0 60px rgba(212,168,83,0.2)'}}
        />
        <a href="https://getscriptflow.com" target="_blank" style={{position:'absolute',bottom:'12px',right:'12px',color:'rgba(255,255,255,0.5)',fontSize:'0.65rem',textDecoration:'none',background:'rgba(0,0,0,0.3)',padding:'3px 8px',borderRadius:'20px'}}>
          getscriptflow.com
        </a>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'12px',width:'100%',maxWidth:'360px'}}>
        <button
          onClick={() => window.open(movie.final_video_url, '_blank')}
          style={{background:'#D4A853',color:'#000',border:'none',padding:'16px',borderRadius:'100px',fontWeight:'800',fontSize:'1rem',cursor:'pointer',width:'100%'}}
        >
          📱 Open Video to Save
        </button>
        <p style={{color:'#888',fontSize:'0.75rem',textAlign:'center',marginTop:'8px'}}>
          Tap Share → Save to Photos
        </p>

        <button
          onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{background:'#1a1a1a',color:'white',border:'1px solid #333',padding:'16px',borderRadius:'100px',fontWeight:'700',fontSize:'1rem',cursor:'pointer'}}
        >
          {copied ? '✅ Link Copied!' : '🔗 Copy Share Link'}
        </button>

        <a href="/create" style={{display:'block',background:'transparent',color:'#555',padding:'16px',borderRadius:'100px',fontWeight:'600',fontSize:'0.9rem',textDecoration:'none',textAlign:'center',border:'1px solid #222'}}>
          🎬 Make Another Movie
        </a>
      </div>
    </div>
  )
}
