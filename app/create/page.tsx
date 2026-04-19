'use client'
import { useState, useRef } from 'react'

export default function CreatePage() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoUrl(URL.createObjectURL(file))
    console.log('[create] photo selected:', file.name)
  }

  const handleGenerate = async () => {
    if (!photoFile) { setError('Please upload your photo first'); return }
    if (!story.trim()) { setError('Please enter your story'); return }
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('photo', photoFile)
      form.append('story', story)
      form.append('tier', '60s')
      const res = await fetch('/api/create-movie', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      window.location.href = `/movie/${data.movieId}`
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',fontFamily:'system-ui'}}>
      
      <h1 style={{color:'#D4A853',fontSize:'2rem',marginBottom:'8px'}}>You Are the Star</h1>
      <p style={{color:'#888',marginBottom:'40px'}}>One photo. One story. Your movie.</p>

      <input 
        ref={inputRef}
        type="file" 
        accept="image/jpeg,image/jpg,image/png,image/webp" 
        onChange={handlePhoto} 
        style={{display:'none'}} 
      />

      <div 
        onClick={() => inputRef.current?.click()}
        style={{cursor:'pointer',marginBottom:'32px'}}
      >
        {photoUrl
          ? <img src={photoUrl} style={{width:'120px',height:'120px',borderRadius:'50%',objectFit:'cover',border:'3px solid #D4A853'}} />
          : <div style={{width:'120px',height:'120px',borderRadius:'50%',border:'2px dashed #D4A853',display:'flex',alignItems:'center',justifyContent:'center',color:'#D4A853',fontSize:'2rem'}}>📷</div>
        }
      </div>

      <textarea
        placeholder="Tell your story..."
        value={story}
        onChange={e => setStory(e.target.value)}
        style={{width:'100%',maxWidth:'500px',padding:'16px',background:'#111',color:'white',border:'1px solid #333',borderRadius:'12px',fontSize:'1rem',minHeight:'100px',marginBottom:'24px',resize:'none'}}
      />

      {error && <p style={{color:'red',marginBottom:'16px'}}>{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{background:'#D4A853',color:'#000',border:'none',padding:'18px 48px',fontSize:'1.1rem',fontWeight:'800',borderRadius:'100px',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1}}
      >
        {loading ? 'Creating...' : 'Make the Movie ✨'}
      </button>

      {loading && <p style={{color:'#888',marginTop:'24px',textAlign:'center'}}>Creating your movie...<br/>2-5 minutes</p>}
    </div>
  )
}
