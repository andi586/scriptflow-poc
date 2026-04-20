'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Movie {
  id: string
  final_video_url: string | null
  status: string
  tier: string
  story_input: string
}

export default function MoviePage() {
  const params = useParams()
  const movieId = params?.movieId as string

  const [movie, setMovie] = useState<Movie | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!movieId) return

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchMovie = async () => {
      const { data } = await supabase
        .from('movies')
        .select('*')
        .eq('id', movieId)
        .single()
      setMovie(data)
      setLoading(false)
    }

    fetchMovie()

    // Poll every 5s if not complete yet
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('movies')
        .select('*')
        .eq('id', movieId)
        .single()
      setMovie(data)
      if (data?.final_video_url) clearInterval(interval)
    }, 5000)

    return () => clearInterval(interval)
  }, [movieId])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  if (!movie || !movie.final_video_url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-4">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        <p className="text-white text-lg">Your movie is being created...</p>
        <p className="text-gray-400 text-sm">This takes 2–5 minutes. This page will update automatically.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <h1 className="text-white text-2xl mb-6">Your Movie</h1>

      <div style={{position:'relative', display:'inline-block'}}>
        <video
          src={movie.final_video_url}
          controls
          autoPlay
          playsInline
          className="max-h-[80vh] rounded-lg shadow-2xl"
          style={{ maxWidth: '400px' }}
        />
        <a
          href="https://getscriptflow.com"
          target="_blank"
          style={{
            position:'absolute',
            bottom:'12px',
            right:'12px',
            color:'rgba(255,255,255,0.5)',
            fontSize:'0.7rem',
            textDecoration:'none',
            background:'rgba(0,0,0,0.25)',
            padding:'3px 8px',
            borderRadius:'20px',
            backdropFilter:'blur(4px)',
            letterSpacing:'0.5px'
          }}
        >
          getscriptflow.com
        </a>
      </div>

      <div className="flex gap-4 mt-6">
        <a
          href={movie.final_video_url}
          download="my-movie.mp4"
          className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors"
        >
          Download
        </a>
        <button
          onClick={handleCopyLink}
          className="bg-gray-700 text-white px-6 py-3 rounded-full font-bold hover:bg-gray-600 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}
