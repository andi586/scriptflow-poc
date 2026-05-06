'use client'
import { useState, useEffect, useRef } from 'react'
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
  const [showPaywall, setShowPaywall] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(true)
  const [price, setPrice] = useState(2.9)
  const [videoLoading, setVideoLoading] = useState(true)
  const [showCutoff, setShowCutoff] = useState(false)
  const [cutoffTriggered, setCutoffTriggered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const paywallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Emotional cutoff lines based on template
  const CUTOFF_LINES: Record<string, string> = {
    'she_didnt_choose_you': "The message wasn't from another girl.\nIt was from her.",
    'phone_3am': "The message wasn't from another girl.\nIt was from her.",
    'lost_someone': "I wasn't waiting to leave.\nI was waiting for you to understand…",
    'dog_last_words': "I wasn't waiting to leave.\nI was waiting for you to understand…",
    'last_person': "They didn't remove you from the chat.\nThey muted you.",
    'group_chat': "They didn't remove you from the chat.\nThey muted you.",
    'future_you': "I didn't come back to save you.\nI came back to stop you—",
    'future_warning': "I didn't come back to save you.\nI came back to stop you—",
    'friend_betrayal': "I didn't betray you.\nYou told me to.",
    'what_could_have_been': "We were happy.\nUntil you chose this life.",
    'parallel_universe': "We were happy.\nUntil you chose this life.",
    'breaking_news': "Authorities confirm the suspect is—"
  }

  // Template-specific CTAs
  const PAYWALL_CTA: Record<string, string> = {
    'she_didnt_choose_you': "Finish your story.",
    'phone_3am': "Finish your story.",
    'lost_someone': "Hear the last words.",
    'dog_last_words': "Hear the last words.",
    'last_person': "See what they said next.",
    'group_chat': "See what they said next.",
    'future_you': "Find out what you become.",
    'future_warning': "Find out what you become.",
    'friend_betrayal': "Remember what you said.",
    'what_could_have_been': "See the life you lost.",
    'parallel_universe': "See the life you lost.",
    'breaking_news': "Reveal the suspect."
  }

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
      if (data?.final_video_url || data?.hook_video_url) {
        setMovie(data)
        if (data?.final_video_url) clearInterval(interval)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [movieId])

  // Emotional cutoff at 10-12 seconds
  useEffect(() => {
    if (!videoRef.current || !movie?.hook_video_url || movie?.paid || cutoffTriggered) return

    const video = videoRef.current
    
    const handleTimeUpdate = () => {
      // Trigger cutoff at 10-12 seconds
      if (video.currentTime >= 10 && !cutoffTriggered) {
        setCutoffTriggered(true)
        setShowCutoff(true)
        
        // Pause video
        video.pause()
        
        // Show paywall after cutoff animation
        setTimeout(() => {
          setShowPaywall(true)
        }, 1500)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [movie?.hook_video_url, movie?.paid, cutoffTriggered])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white'}}>
      <div style={{fontSize:'3rem',marginBottom:'24px'}}>🎬</div>
      <h2 style={{color:'#D4A853',marginBottom:'12px'}}>Creating your movie...</h2>
      <p style={{color:'#888'}}>This takes 2-5 minutes</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{marginTop:'32px',width:'40px',height:'40px',border:'3px solid #D4A853',borderTop:'3px solid transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
      <button
        onClick={() => window.location.reload()}
        style={{marginTop:'16px',background:'#D4A853',color:'#000',border:'none',padding:'12px 24px',borderRadius:'100px',fontWeight:'700',cursor:'pointer'}}
      >
        🔄 Check if ready
      </button>
    </div>
  )

  // ── Paywall view (paid=false) - show regardless of hook status ─────────
  if (!movie?.paid) {
    return (
      <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px 120px',color:'white',fontFamily:'system-ui'}}>
        <h1 style={{color:'#D4A853',fontSize:'1.3rem',marginBottom:'4px'}}>
          {movie?.hook_video_url ? '🎬 Your Preview is Ready' : '⏳ Generating Your Preview...'}
        </h1>
        <p style={{color:'#555',fontSize:'0.85rem',marginBottom:'24px'}}>
          {movie?.hook_video_url ? 'Watch the first 15 seconds of your movie' : 'Your hook video is being created'}
        </p>

        <div style={{position:'relative',display:'inline-block',marginBottom:'8px'}}>
          {/* Loading skeleton */}
          {videoLoading && (
            <div style={{
              width:'360px',
              height:'640px',
              maxHeight:'70vh',
              borderRadius:'16px',
              background:'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              backgroundSize:'200% 100%',
              animation:'shimmer 1.5s infinite',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              color:'#666',
              fontSize:'0.9rem'
            }}>
              <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
              Loading preview...
            </div>
          )}
          <video
            ref={videoRef}
            src={movie.hook_video_url}
            autoPlay
            playsInline
            muted={false}
            onLoadedData={() => setVideoLoading(false)}
            style={{
              maxHeight:'70vh',
              maxWidth:'360px',
              borderRadius:'16px',
              boxShadow:'0 0 60px rgba(212,168,83,0.2)',
              display: videoLoading ? 'none' : 'block',
              animation: showCutoff ? 'screenShake 0.5s ease-in-out' : 'none'
            }}
          />

          {/* Cutoff overlay - emotional interrupt */}
          {showCutoff && (
            <div style={{
              position:'absolute',
              inset:0,
              borderRadius:'16px',
              background:'rgba(0,0,0,0.95)',
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              justifyContent:'center',
              padding:'32px 24px',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              <div style={{
                color:'#fff',
                fontSize:'1.3rem',
                fontWeight:'700',
                textAlign:'center',
                lineHeight:'1.6',
                whiteSpace:'pre-line',
                marginBottom:'24px',
                animation: 'glitchText 0.5s ease-in-out'
              }}>
                {CUTOFF_LINES[movie.archetype] || "The story continues..."}
              </div>
            </div>
          )}

          {/* Paywall overlay */}
          {showPaywall && (
            <div style={{
              position:'absolute',
              inset:0,
              borderRadius:'16px',
              background:'linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.85) 40%, rgba(10,10,10,0.98) 100%)',
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              justifyContent:'flex-end',
              padding:'32px 24px',
              gap:'12px',
              animation: 'fadeIn 0.5s ease-in'
            }}>
              <p style={{color:'#D4A853',fontWeight:'800',fontSize:'1.3rem',textAlign:'center',margin:0,marginBottom:'8px'}}>
                {PAYWALL_CTA[movie.archetype] || "Unlock Your Movie"}
              </p>
              <p style={{color:'#aaa',fontSize:'0.85rem',textAlign:'center',margin:0}}>
                {isFirstTime ? '$2.9 - First Movie Special' : '$4.9 - Unlock Full Movie'}
              </p>
              <button
                onClick={async () => {
                  const res = await fetch('/api/stripe/movie-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      movieId: movie.id,
                      userId: movie.user_id 
                    })
                  })
                  const data = await res.json()
                  if (data.checkoutUrl || data.url) {
                    // Update pricing info from response
                    if (data.isFirstTime !== undefined) setIsFirstTime(data.isFirstTime)
                    if (data.price !== undefined) setPrice(data.price)
                    window.location.href = data.checkoutUrl || data.url
                  } else {
                    alert('Payment error: ' + (data.error || 'Unknown error'))
                  }
                }}
                style={{
                  background:'#D4A853',
                  color:'#000',
                  border:'none',
                  borderRadius:'100px',
                  padding:'16px 40px',
                  fontWeight:'800',
                  fontSize:'1.1rem',
                  cursor:'pointer',
                  width:'100%',
                  maxWidth:'280px',
                  boxShadow:'0 8px 30px rgba(212,168,83,0.4)',
                  transition:'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(212,168,83,0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,168,83,0.4)';
                }}
              >
                🔓 Unlock now → ${price}
              </button>
            </div>
          )}
        </div>

        {/* Watermark text below hook video */}
        <p style={{color:'#555',fontSize:'0.7rem',textAlign:'center',marginBottom:'24px',marginTop:'4px'}}>
          ScriptFlow.com - Be the star of your own movie
        </p>

        {!showPaywall && (
          <p style={{color:'#555',fontSize:'0.8rem',textAlign:'center'}}>
            Full movie unlocks in a moment...
          </p>
        )}

        {/* CSS Animations for cutoff effects */}
        <style jsx>{`
          @keyframes screenShake {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-5px, 2px); }
            20% { transform: translate(5px, -2px); }
            30% { transform: translate(-3px, 3px); }
            40% { transform: translate(3px, -3px); }
            50% { transform: translate(-2px, 2px); }
            60% { transform: translate(2px, -2px); }
            70% { transform: translate(-1px, 1px); }
            80% { transform: translate(1px, -1px); }
            90% { transform: translate(0, 0); }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes glitchText {
            0% { 
              opacity: 0;
              transform: translateX(-10px);
              filter: blur(5px);
            }
            20% {
              opacity: 0.5;
              transform: translateX(5px);
              filter: blur(2px);
            }
            40% {
              opacity: 0.8;
              transform: translateX(-3px);
              filter: blur(1px);
            }
            60% {
              opacity: 1;
              transform: translateX(2px);
              filter: blur(0px);
            }
            100% {
              opacity: 1;
              transform: translateX(0);
              filter: blur(0px);
            }
          }
        `}</style>
      </div>
    )
  }

  // ── Waiting for final video (no hook yet either) ───────────────────────────
  if (!movie?.final_video_url) return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'white'}}>
      <div style={{fontSize:'3rem',marginBottom:'24px'}}>🎬</div>
      <h2 style={{color:'#D4A853',marginBottom:'12px'}}>Creating your movie...</h2>
      <p style={{color:'#888'}}>This takes 2-5 minutes</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{marginTop:'32px',width:'40px',height:'40px',border:'3px solid #D4A853',borderTop:'3px solid transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
      <button
        onClick={() => window.location.reload()}
        style={{marginTop:'16px',background:'#D4A853',color:'#000',border:'none',padding:'12px 24px',borderRadius:'100px',fontWeight:'700',cursor:'pointer'}}
      >
        🔄 Check if ready
      </button>
    </div>
  )

  // ── Final video ready ─────────────────────────────────────────────────────
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
        {!movie.paid && (
          <a href="https://getscriptflow.com" target="_blank" style={{position:'absolute',bottom:'12px',right:'12px',color:'rgba(255,255,255,0.5)',fontSize:'0.65rem',textDecoration:'none',background:'rgba(0,0,0,0.3)',padding:'3px 8px',borderRadius:'20px'}}>
            getscriptflow.com
          </a>
        )}
      </div>

      {/* Share Message */}
      <div style={{textAlign:'center',marginBottom:'24px',maxWidth:'360px'}}>
        <p style={{color:'#D4A853',fontSize:'1.1rem',fontWeight:'700',marginBottom:'4px'}}>
          Share your movie and get 1 FREE generation!
        </p>
        <p style={{color:'#666',fontSize:'0.8rem'}}>
          Tag @ScriptFlow for a chance to be featured
        </p>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:'12px',width:'100%',maxWidth:'360px'}}>
        {/* Share Buttons Row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'8px',marginBottom:'8px'}}>
          <a
            href={movie.final_video_url}
            download="my-movie.mp4"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#D4A853',
              color: '#000',
              padding: '14px 8px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '0.85rem',
              textAlign: 'center',
              textDecoration: 'none',
              gap: '4px'
            }}
          >
            <span style={{fontSize:'1.5rem'}}>📥</span>
            <span>Download</span>
          </a>

          <button
            onClick={() => {
              // Try to open TikTok app or web
              const tiktokUrl = `https://www.tiktok.com/upload`;
              window.open(tiktokUrl, '_blank');
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
              color: '#fff',
              border: '2px solid #D4A853',
              padding: '14px 8px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '0.85rem',
              textAlign: 'center',
              cursor: 'pointer',
              gap: '4px'
            }}
          >
            <span style={{fontSize:'1.5rem'}}>📱</span>
            <span>TikTok</span>
          </button>

          <button
            onClick={() => { 
              const url = `https://getscriptflow.com/movie/${movieId}`;
              navigator.clipboard.writeText(url); 
              setCopied(true); 
              setTimeout(() => setCopied(false), 2000);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#1a1a1a',
              color: '#D4A853',
              border: '2px solid #333',
              padding: '14px 8px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '0.85rem',
              textAlign: 'center',
              cursor: 'pointer',
              gap: '4px'
            }}
          >
            <span style={{fontSize:'1.5rem'}}>{copied ? '✅' : '🔗'}</span>
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        <p style={{color:'#666',fontSize:'0.72rem',textAlign:'center',lineHeight:'1.6'}}>
          💡 iPhone: Long press video → Save to Photos
        </p>

        <a href="/create" style={{display:'block',background:'transparent',color:'#555',padding:'16px',borderRadius:'100px',fontWeight:'600',fontSize:'0.9rem',textDecoration:'none',textAlign:'center',border:'1px solid #222',marginTop:'12px'}}>
          🎬 Make Another Movie
        </a>

        {/* Survey Prompt */}
        {movie?.paid && (
          <div style={{marginTop:'32px',background:'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',padding:'24px',borderRadius:'20px',textAlign:'center'}}>
            <p style={{color:'white',fontSize:'1.1rem',fontWeight:'700',marginBottom:'12px'}}>
              🎬 Enjoying your movie?
            </p>
            <p style={{color:'rgba(255,255,255,0.9)',fontSize:'0.9rem',marginBottom:'16px'}}>
              Share your feedback and get 1 FREE movie!
            </p>
            <a
              href={`/survey?movieId=${movie.id}`}
              style={{
                display:'inline-block',
                background:'white',
                color:'#667eea',
                padding:'14px 32px',
                borderRadius:'100px',
                fontWeight:'800',
                fontSize:'1rem',
                textDecoration:'none',
                boxShadow:'0 4px 15px rgba(0,0,0,0.2)'
              }}
            >
              Take Survey →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
