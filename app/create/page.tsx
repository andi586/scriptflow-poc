'use client'
import { useState, useRef, useEffect } from 'react'

// ── DEV MODE bypass ──────────────────────────────────────────────────────────
// true in local dev → skip Stripe paywall, redirect directly to movie page
// false in production → normal payment-gated flow
// REMOVE before production release.
const DEV_MODE = process.env.NODE_ENV === 'development'
// ── End DEV MODE ─────────────────────────────────────────────────────────────

interface CharacterPhoto {
  file: File | null
  url: string | null
}

const CHARACTER_SLOTS = [
  { id: 1, label: '主角 / You', required: true },
  { id: 2, label: '朋友 2 / Friend 2', required: false },
  { id: 3, label: '朋友 3 / Friend 3', required: false },
  { id: 4, label: '朋友 4 / Friend 4', required: false },
  { id: 5, label: '朋友 5 / Friend 5', required: false },
  { id: 6, label: '朋友 6 / Friend 6', required: false },
  { id: 7, label: '宠物 / Pet', required: false },
]

export default function CreatePage() {
  const [characters, setCharacters] = useState<CharacterPhoto[]>(
    Array(7).fill(null).map(() => ({ file: null, url: null }))
  )
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const savedUrl = localStorage.getItem('sf_photo_url')
    if (savedUrl) {
      setCharacters(prev => {
        const updated = [...prev]
        updated[0] = { file: null, url: savedUrl }
        return updated
      })
    }
  }, [])

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setCharacters(prev => {
      const updated = [...prev]
      updated[index] = { file, url: URL.createObjectURL(file) }
      return updated
    })
  }

  const removePhoto = (index: number) => {
    setCharacters(prev => {
      const updated = [...prev]
      updated[index] = { file: null, url: null }
      return updated
    })
  }

  const handleGenerate = async () => {
    const savedTwinId = localStorage.getItem('sf_twin_id')
    const mainPhoto = characters[0]
    
    if (!mainPhoto.url && !savedTwinId) { 
      setError('Please upload your photo first (Slot 1 is required)'); 
      return 
    }
    if (!story.trim()) { setError('Tell us your story first'); return }
    
    setLoading(true)
    setError(null)
    try {
      let movieId: string
      if (savedTwinId && !mainPhoto.file) {
        const res = await fetch('/api/movie/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ story, tier: '60s', userId: savedTwinId })
        })
        const data = await res.json()
        console.log('[create] response data:', data)
        console.log('[create] movieId:', data.movieId)
        if (!res.ok) throw new Error(data.error || 'Failed')
        if (!data.movieId) {
          setError('Movie creation failed: ' + (data.error || 'No movie ID returned'))
          setLoading(false)
          return
        }
        movieId = data.movieId
      } else {
        const form = new FormData()
        form.append('photo', mainPhoto.file!)
        form.append('story', story)
        form.append('tier', '60s')
        
        // Add all additional character photos (slots 2-7)
        let castIndex = 0
        for (let i = 1; i < 7; i++) {
          if (characters[i].file) {
            form.append(`cast_${castIndex}`, characters[i].file!)
            castIndex++
          }
        }
        
        const res = await fetch('/api/create-movie', { method: 'POST', body: form })
        const data = await res.json()
        console.log('[create] response data:', data)
        console.log('[create] movieId:', data.movieId)
        if (!res.ok) throw new Error(data.error || 'Failed')
        if (!data.movieId) {
          setError('Movie creation failed: ' + (data.error || 'No movie ID returned'))
          setLoading(false)
          return
        }
        movieId = data.movieId
        if (data.twinId) localStorage.setItem('sf_twin_id', data.twinId)
        if (data.photoUrl) localStorage.setItem('sf_photo_url', data.photoUrl)
      }
      // Call /api/hook/generate (fire and forget — non-blocking)
      console.log('[create] calling /api/hook/generate for movieId:', movieId)
      fetch('/api/hook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId })
      }).then(hookRes => hookRes.json()).then(hookData => {
        console.log('[create] hook/generate response:', hookData)
      }).catch(hookErr => {
        console.warn('[create] hook/generate failed (non-fatal):', hookErr)
      })

      // Redirect to movie page
      console.log('[create] redirecting to movie:', movieId)
      window.location.href = `/movie/${movieId}`

      // if (DEV_MODE) {
      //   // DEV MODE: skip Stripe, go directly to movie page
      //   console.log('[create] DEV_MODE — skipping payment, redirecting to movie:', movieId)
      //   window.location.href = `/movie/${movieId}`
      // } else {
      //   // Redirect to Stripe payment before generating
      //   const stripeRes = await fetch('/api/stripe/movie-checkout', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ movieId, userId: localStorage.getItem('sf_user_id') || '' })
      //   })
      //   const stripeData = await stripeRes.json()
      //   console.log('[stripe] response:', stripeRes.status, stripeData)
      //   if (stripeData.checkoutUrl) {
      //     window.location.href = stripeData.checkoutUrl
      //   } else {
      //     console.error('[stripe] no checkoutUrl:', stripeData)
      //     alert('Payment error: ' + (stripeData.error || 'Unknown error'))
      //   }
      // }
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 140px', fontFamily: 'system-ui', position: 'relative' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: '600px', marginBottom: '8px' }}>
        <a href="/my-videos" style={{ color: '#888', fontSize: '0.8rem', textDecoration: 'none', padding: '4px 12px', border: '1px solid #333', borderRadius: '9999px' }}>
          🎞️ My Videos
        </a>
      </div>
      <h1 style={{ color: '#D4A853', fontSize: '1.8rem', marginBottom: '4px', textAlign: 'center' }}>SquadCast - Your Story, Your Crew</h1>
      <p style={{ color: '#555', marginBottom: '32px', fontSize: '0.9rem' }}>Add up to 7 characters to your movie ✨</p>

      {/* Hidden file inputs */}
      {CHARACTER_SLOTS.map((slot, index) => (
        <input
          key={slot.id}
          ref={el => { fileInputRefs.current[index] = el }}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => handlePhotoChange(index, e)}
          style={{ display: 'none' }}
        />
      ))}

      {/* Character photo slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px', width: '100%', maxWidth: '600px', marginBottom: '32px', padding: '0 20px' }}>
        {CHARACTER_SLOTS.map((slot, index) => {
          const character = characters[index]
          const hasPhoto = character.url !== null
          
          return (
            <div key={slot.id} style={{ textAlign: 'center', position: 'relative' }}>
              <div
                onClick={() => fileInputRefs.current[index]?.click()}
                style={{
                  cursor: 'pointer',
                  width: '100%',
                  aspectRatio: '1',
                  maxWidth: '120px',
                  margin: '0 auto',
                  borderRadius: '50%',
                  border: hasPhoto 
                    ? (slot.required ? '3px solid #D4A853' : '2px solid #555')
                    : (slot.required ? '2px dashed #D4A853' : '2px dashed #333'),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  background: hasPhoto ? 'transparent' : '#111'
                }}
              >
                {hasPhoto ? (
                  <img 
                    src={character.url!} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover' 
                    }} 
                    alt={slot.label}
                  />
                ) : (
                  <>
                    <span style={{ fontSize: '1.5rem' }}>📷</span>
                    <span style={{ fontSize: '0.65rem', color: slot.required ? '#D4A853' : '#555', marginTop: '4px' }}>
                      {slot.required ? 'Required' : 'Optional'}
                    </span>
                  </>
                )}
              </div>
              
              {hasPhoto && !slot.required && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removePhoto(index)
                  }}
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '50%',
                    transform: 'translateX(calc(50% + 50px))',
                    background: '#333',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    color: '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >✕</button>
              )}
              
              <p style={{ 
                color: slot.required ? '#D4A853' : '#888', 
                fontSize: '0.7rem', 
                marginTop: '8px',
                fontWeight: slot.required ? 600 : 400
              }}>
                {slot.label}
              </p>
              {hasPhoto && (
                <p style={{ color: '#555', fontSize: '0.65rem', marginTop: '2px' }}>
                  Tap to change
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Story input */}
      <div style={{ width: '100%', maxWidth: '600px', marginBottom: '24px', padding: '0 20px' }}>
        <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
          What's your story?
        </label>
        <textarea
          value={story}
          onChange={e => setStory(e.target.value)}
          placeholder="e.g. My best friend pranks me at work and it goes viral..."
          rows={4}
          style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '12px', color: 'white', padding: '12px', fontSize: '0.95rem', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: '#ff4444', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{ background: loading ? '#333' : '#D4A853', color: loading ? '#666' : '#000', border: 'none', borderRadius: '24px', padding: '14px 48px', fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
      >
        {loading ? '✨ Creating your movie...' : '🎬 Create My Movie'}
      </button>

      <p style={{ color: '#333', fontSize: '0.75rem', marginTop: '16px' }}>~60 second clip • Free to try</p>

      <a href="/my-videos" style={{
        display: 'block',
        textAlign: 'center',
        color: '#555',
        fontSize: '0.85rem',
        marginTop: '16px',
        textDecoration: 'none'
      }}>
        📽️ My Videos
      </a>
    </div>
  )
}
