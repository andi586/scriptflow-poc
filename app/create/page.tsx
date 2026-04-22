'use client'
import { useState, useRef, useEffect } from 'react'

type Role = 'me' | 'prank' | 'pet' | 'love' | 'crew'

interface CastPhoto {
  role: Role
  file: File
  url: string
}

const DYNAMIC_QUESTIONS: Record<string, string> = {
  default: "What's your story?",
  prank: "Who's the lucky victim? What happens? 😈",
  pet: "What adventure do you and your pet go on? 🐾",
  love: "What do you wish you could say to them? ❤️",
  crew: "What crazy thing happens to you guys? 🎉",
}

export default function CreatePage() {
  const [mePhoto, setMePhoto] = useState<{ file: File | null; url: string } | null>(null)
  const [cast, setCast] = useState<CastPhoto[]>([])
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meInputRef = useRef<HTMLInputElement>(null)
  const castInputRef = useRef<HTMLInputElement>(null)
  const [pendingRole, setPendingRole] = useState<Role | null>(null)

  useEffect(() => {
    const savedUrl = localStorage.getItem('sf_photo_url')
    if (savedUrl) setMePhoto({ file: null, url: savedUrl })
  }, [])

  const totalPhotos = (mePhoto ? 1 : 0) + cast.length
  const remaining = 7 - totalPhotos

  const handleMePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMePhoto({ file, url: URL.createObjectURL(file) })
  }

  const handleCastPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingRole) return
    setCast(prev => [...prev.filter(c => c.role !== pendingRole), { role: pendingRole, file, url: URL.createObjectURL(file) }])
    setPendingRole(null)
    setShowAddMenu(false)
  }

  const addCast = (role: Role) => {
    setPendingRole(role)
    setShowAddMenu(false)
    castInputRef.current?.click()
  }

  const removeCast = (role: Role) => setCast(prev => prev.filter(c => c.role !== role))

  const getDynamicQuestion = () => {
    if (cast.length === 0) return DYNAMIC_QUESTIONS.default
    const roles = cast.map(c => c.role)
    if (roles.includes('prank')) return DYNAMIC_QUESTIONS.prank
    if (roles.includes('pet')) return DYNAMIC_QUESTIONS.pet
    if (roles.includes('love')) return DYNAMIC_QUESTIONS.love
    if (roles.includes('crew')) return DYNAMIC_QUESTIONS.crew
    return DYNAMIC_QUESTIONS.default
  }

  const handleGenerate = async () => {
    const savedTwinId = localStorage.getItem('sf_twin_id')
    if (!mePhoto && !savedTwinId) { setError('Please upload your photo first'); return }
    if (!story.trim()) { setError('Tell us your story first'); return }
    setLoading(true)
    setError(null)
    try {
      let movieId: string
      if (savedTwinId && !mePhoto?.file) {
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
        form.append('photo', mePhoto!.file!)
        form.append('story', story)
        form.append('tier', '60s')
        cast.forEach((c, i) => form.append(`cast_${i}`, c.file))
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
      window.location.href = `/movie/${movieId}`
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  const castLabels: Record<Role, string> = {
    me: 'Me', prank: '😂 Prank', pet: '🐾 Pet', love: '❤️ Love', crew: '👥 Crew'
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 140px', fontFamily: 'system-ui', position: 'relative' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: '400px', marginBottom: '8px' }}>
        <a href="/my-videos" style={{ color: '#888', fontSize: '0.8rem', textDecoration: 'none', padding: '4px 12px', border: '1px solid #333', borderRadius: '9999px' }}>
          🎞️ My Videos
        </a>
      </div>
      <h1 style={{ color: '#D4A853', fontSize: '1.8rem', marginBottom: '4px', textAlign: 'center' }}>You Are the Star</h1>
      <p style={{ color: '#555', marginBottom: '40px', fontSize: '0.9rem' }}>Your face is remembered forever ✨</p>

      <input ref={meInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleMePhoto} style={{ display: 'none' }} />
      <input ref={castInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleCastPhoto} style={{ display: 'none' }} />

      {/* Me photo */}
      <div onClick={() => meInputRef.current?.click()} style={{ cursor: 'pointer', marginBottom: '24px', textAlign: 'center' }}>
        {mePhoto
          ? <>
              <img src={mePhoto.url} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #D4A853', display: 'block', margin: '0 auto' }} />
              <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '6px' }}>Tap to change</p>
            </>
          : <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '2px dashed #D4A853', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#D4A853', gap: '4px' }}>
              <span style={{ fontSize: '1.8rem' }}>📷</span>
              <span style={{ fontSize: '0.7rem' }}>Add Me</span>
            </div>
        }
      </div>

      {/* Cast photos */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '32px', maxWidth: '400px' }}>
        {cast.map(c => (
          <div key={c.role} style={{ textAlign: 'center', position: 'relative' }}>
            <img src={c.url} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333' }} />
            <p style={{ color: '#888', fontSize: '0.65rem', marginTop: '4px' }}>{castLabels[c.role]}</p>
            <button
              onClick={() => removeCast(c.role)}
              style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#333', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#aaa', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          </div>
        ))}

        {remaining > 0 && (
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowAddMenu(v => !v)}
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px dashed #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#555', cursor: 'pointer', gap: '2px' }}
            >
              <span style={{ fontSize: '1.4rem' }}>+</span>
              <span style={{ fontSize: '0.6rem' }}>Cast</span>
            </div>

            {showAddMenu && (
              <div style={{ position: 'absolute', top: '72px', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '8px', zIndex: 100, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(['prank', 'pet', 'love', 'crew'] as Role[])
                  .filter(r => !cast.find(c => c.role === r))
                  .map(role => (
                    <button
                      key={role}
                      onClick={() => addCast(role)}
                      style={{ background: 'none', border: 'none', color: 'white', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', textAlign: 'left', fontSize: '0.85rem' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {castLabels[role]}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {totalPhotos > 0 && (
        <p style={{ color: remaining === 0 ? '#ff4444' : '#555', fontSize: '0.75rem', marginBottom: '16px', textAlign: 'center' }}>
          {remaining === 0 
            ? '✕ Maximum 7 photos reached' 
            : `${totalPhotos}/7 photos used · ${remaining} slots remaining`
          }
        </p>
      )}

      {/* Story input */}
      <div style={{ width: '100%', maxWidth: '400px', marginBottom: '24px' }}>
        <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
          {getDynamicQuestion()}
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
    </div>
  )
}
