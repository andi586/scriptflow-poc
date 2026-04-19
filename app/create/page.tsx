'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CreatePage() {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleGenerate = async () => {
    if (!photo) { setError('Please upload your photo first'); return }
    if (!story) { setError('Please enter your story'); return }
    
    setLoading(true)
    setError(null)

    try {
      // 1. Upload photo
      const fileName = `twins/${Date.now()}_photo.jpg`
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, photo, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message)

      // 2. Get public URL
      const { data: pub } = supabase.storage.from('recordings').getPublicUrl(fileName)
      const photoPublicUrl = pub.publicUrl

      // 3. Create digital twin
      const { data: twin, error: twinError } = await supabase
        .from('digital_twins')
        .insert({ 
          user_id: crypto.randomUUID(),
          frame_url_mid: photoPublicUrl,
          is_active: true 
        })
        .select()
        .single()
      if (twinError) throw new Error('Twin creation failed: ' + twinError.message)

      console.log('[create] twin created:', twin.id)

      // 4. Generate movie
      const res = await fetch('/api/movie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          tier: '60s',
          userId: twin.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      // 5. Redirect to movie page
      window.location.href = `/movie/${data.movieId}`

    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', padding: '40px 20px', fontFamily: 'system-ui' }}>
      <h1 style={{ textAlign: 'center', color: '#D4A853', fontSize: '2rem', marginBottom: '40px' }}>
        Create Your Movie
      </h1>

      {/* Photo Upload */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        {photoUrl ? (
          <img src={photoUrl} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #D4A853' }} />
        ) : (
          <label style={{ cursor: 'pointer', display: 'inline-block', padding: '20px 40px', border: '2px dashed #D4A853', borderRadius: '12px', color: '#D4A853' }}>
            📷 Upload Your Photo
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      {/* Story Input */}
      <textarea
        placeholder="Tell your story... (e.g. Mom, it's been 15 years)"
        value={story}
        onChange={e => setStory(e.target.value)}
        style={{ width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto 32px', padding: '16px', background: '#111', color: 'white', border: '1px solid #333', borderRadius: '12px', fontSize: '1rem', minHeight: '120px' }}
      />

      {/* Error */}
      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}

      {/* Generate Button */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{ background: '#D4A853', color: '#000', border: 'none', padding: '20px 48px', fontSize: '1.1rem', fontWeight: '800', borderRadius: '100px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Creating your movie...' : 'Make the Movie ✨'}
        </button>
      </div>

      {loading && (
        <p style={{ textAlign: 'center', color: '#888', marginTop: '24px' }}>
          Your movie is being created. This takes 2-5 minutes...
        </p>
      )}
    </div>
  )
}
