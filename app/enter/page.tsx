'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EnterPage() {
  const [pwd, setPwd] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  const handleSubmit = () => {
    if (pwd === 'heaven2026') {
      document.cookie = `sf_access=${pwd}; max-age=${60*60*24*7}; path=/`
      router.push('/create')
    } else {
      setError(true)
    }
  }

  return (
    <div style={{background:'#0a0a0a',minHeight:'100vh',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui'}}>
      <h1 style={{color:'#D4A853',fontSize:'2rem',marginBottom:'8px'}}>Heaven Cinema</h1>
      <p style={{color:'#888',marginBottom:'40px'}}>Private Beta Access</p>
      
      <input
        type="password"
        placeholder="Enter access code"
        value={pwd}
        onChange={e => setPwd(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        style={{padding:'16px 24px',background:'#111',color:'white',border:'1px solid #333',borderRadius:'12px',fontSize:'1rem',marginBottom:'16px',width:'280px',textAlign:'center'}}
      />
      
      {error && <p style={{color:'red',marginBottom:'16px'}}>Wrong code. Try again.</p>}
      
      <button
        onClick={handleSubmit}
        style={{background:'#D4A853',color:'#000',border:'none',padding:'16px 48px',fontSize:'1rem',fontWeight:'800',borderRadius:'100px',cursor:'pointer'}}
      >
        Enter →
      </button>
    </div>
  )
}
