'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Constants ────────────────────────────────────────────────────────────────
const TWIN_ID_KEY = 'sf_twin_id'
const TWIN_FRAME_KEY = 'sf_twin_frame'
const SESSION_ID_KEY = 'sf_session_id'
const MAX_RECORD_SECONDS = 60
const MIN_RECORD_SECONDS = 5

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading'          // checking localStorage for existing twin
  | 'twin_intro'       // no twin yet — explain what digital twin is
  | 'twin_record'      // recording video for twin
  | 'twin_processing'  // uploading + creating twin
  | 'story_input'      // twin exists — enter story
  | 'movie_processing' // generating movie
  | 'result'           // show final video

// ─── Component ────────────────────────────────────────────────────────────────
export default function AppFlowPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [twinId, setTwinId] = useState<string | null>(null)
  const [twinFrameUrl, setTwinFrameUrl] = useState<string | null>(null)
  const [story, setStory] = useState('')
  const [step, setStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  // recording state
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const secondsRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const resultRef = useRef<HTMLVideoElement | null>(null)

  // polling
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // auth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // ── On mount: check for existing twin ─────────────────────────────────────
  useEffect(() => {
    const storedTwinId = localStorage.getItem(TWIN_ID_KEY)
    const storedFrame = localStorage.getItem(TWIN_FRAME_KEY)
    if (storedTwinId && storedFrame) {
      setTwinId(storedTwinId)
      setTwinFrameUrl(storedFrame)
      setPhase('story_input')
    } else {
      setPhase('twin_intro')
    }
  }, [])

  // ── Open camera when entering twin_record ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'twin_record') return
    let alive = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (previewRef.current) previewRef.current.srcObject = stream
      })
      .catch(() => {
        if (alive) setError('Camera access denied. Please allow camera and reload.')
      })
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [phase])

  // ── Auto-play result video ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'result' || !videoUrl) return
    const t = setTimeout(() => {
      resultRef.current?.play().catch(() => {})
    }, 100)
    return () => clearTimeout(t)
  }, [phase, videoUrl])

  // ── Cleanup poll on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  // ── Upload blob to Supabase Storage ───────────────────────────────────────
  const uploadBlob = useCallback(async (blob: Blob, filename: string): Promise<string | null> => {
    try {
      const supabase = createClient()
      const filePath = `tmp/${Date.now()}_${filename}`
      const { data, error } = await supabase.storage
        .from('recordings')
        .upload(filePath, blob, { contentType: blob.type || 'video/webm', upsert: true })
      if (error) { console.warn('[app-flow] upload failed:', error.message); return null }
      return supabase.storage.from('recordings').getPublicUrl(data.path).data.publicUrl
    } catch (e) {
      console.warn('[app-flow] upload error:', e)
      return null
    }
  }, [])

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!streamRef.current) { setError('Camera not ready.'); return }
    setError(null)
    chunksRef.current = []
    setSeconds(0)
    secondsRef.current = 0

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4'

    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime })
    recorderRef.current = recorder
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setIsRecording(false)
      const blob = new Blob(chunksRef.current, { type: mime })
      void processTwinVideo(blob)
    }
    recorder.start(100)
    setIsRecording(true)

    timerRef.current = setInterval(() => {
      secondsRef.current += 1
      setSeconds(s => s + 1)
    }, 1000)

    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    }, MAX_RECORD_SECONDS * 1000)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  // ── Process twin video ─────────────────────────────────────────────────────
  const processTwinVideo = useCallback(async (blob: Blob) => {
    setPhase('twin_processing')
    setStep('Uploading your video...')
    try {
      const mime = blob.type || 'video/webm'
      const ext = mime.includes('mp4') ? 'mp4' : 'webm'
      const videoUrl = await uploadBlob(blob, `twin_${Date.now()}.${ext}`)
      if (!videoUrl) throw new Error('Upload failed')

      setStep('Creating your digital twin...')
      const sessionId = getOrCreateSessionId()
      const res = await fetch('/api/digital-twin/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data.twinId) throw new Error(data.error ?? 'Twin creation failed')

      localStorage.setItem(TWIN_ID_KEY, data.twinId)
      localStorage.setItem(TWIN_FRAME_KEY, data.frameUrl)
      setTwinId(data.twinId)
      setTwinFrameUrl(data.frameUrl)
      setPhase('story_input')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Twin creation failed')
      setPhase('twin_record')
    }
  }, [uploadBlob])

  // ── Generate movie ─────────────────────────────────────────────────────────
  const generateMovie = useCallback(async () => {
    if (!twinId || !story.trim()) return
    setPhase('movie_processing')
    setStep('Generating your dialogue...')
    setError(null)

    try {
      const sessionId = getOrCreateSessionId()
      const res = await fetch('/api/movie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twinId, story: story.trim(), sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data.taskId) throw new Error(data.error ?? 'Movie generation failed')

      const taskId: string = data.taskId
      console.log('[app-flow] movie taskId:', taskId)
      setStep('Animating your digital twin...')

      // ── Poll OmniHuman → Kling ─────────────────────────────────────────
      let attempt = 0
      const MAX_POLL = 120 // 10 min at 5s intervals
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

      pollIntervalRef.current = setInterval(async () => {
        attempt++
        const elapsed = attempt * 5
        const mins = Math.floor(elapsed / 60)
        const secs = elapsed % 60
        setStep(`Generating your movie... (${mins}m ${secs}s)`)

        try {
          const pollRes = await fetch(`/api/omni-human/poll?taskId=${taskId}`)
          const pollData = await pollRes.json()
          console.log(`[app-flow] poll ${attempt}:`, pollData.status)

          if (pollData.status === 'kling_processing' && pollData.klingTaskId) {
            setStep('Creating cinematic scene...')
            // Switch to polling Kling
            clearInterval(pollIntervalRef.current!)
            let klingAttempt = 0
            pollIntervalRef.current = setInterval(async () => {
              klingAttempt++
              const ke = klingAttempt * 5
              setStep(`Creating cinematic scene... (${Math.floor(ke / 60)}m ${ke % 60}s)`)
              try {
                const kr = await fetch(`/api/kling-poll?taskId=${pollData.klingTaskId}`)
                const kd = await kr.json()
                console.log(`[app-flow] kling poll ${klingAttempt}:`, kd.status)
                if (kd.status === 'completed' && kd.videoUrl) {
                  clearInterval(pollIntervalRef.current!)
                  setVideoUrl(kd.videoUrl)
                  setPhase('result')
                } else if (kd.status === 'failed') {
                  clearInterval(pollIntervalRef.current!)
                  setError('Kling scene generation failed')
                  setPhase('story_input')
                }
              } catch {}
              if (klingAttempt >= MAX_POLL) {
                clearInterval(pollIntervalRef.current!)
                setError('Timed out waiting for scene generation')
                setPhase('story_input')
              }
            }, 5000)
          } else if (pollData.status === 'completed' && pollData.videoUrl) {
            clearInterval(pollIntervalRef.current!)
            setVideoUrl(pollData.videoUrl)
            setPhase('result')
          } else if (pollData.status === 'failed') {
            clearInterval(pollIntervalRef.current!)
            setError('Video generation failed')
            setPhase('story_input')
          }
        } catch {}

        if (attempt >= MAX_POLL) {
          clearInterval(pollIntervalRef.current!)
          setError('Timed out waiting for video generation')
          setPhase('story_input')
        }
      }, 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Movie generation failed')
      setPhase('story_input')
    }
  }, [twinId, story])

  // ── Reset twin ─────────────────────────────────────────────────────────────
  const resetTwin = useCallback(() => {
    localStorage.removeItem(TWIN_ID_KEY)
    localStorage.removeItem(TWIN_FRAME_KEY)
    setTwinId(null)
    setTwinFrameUrl(null)
    setPhase('twin_intro')
  }, [])

  // ── Auth button ────────────────────────────────────────────────────────────
  const authButton = user ? (
    <button
      type="button"
      onClick={() => createClient().auth.signOut()}
      style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', cursor: 'pointer' }}
    >
      {user.email?.split('@')[0]} · Sign Out
    </button>
  ) : (
    <a href="/login" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 200, background: 'rgba(139,92,246,0.8)', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-block' }}>
      Sign In
    </a>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: LOADING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TWIN INTRO
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'twin_intro') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        {authButton}
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🎭</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>Create Your Digital Twin</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', maxWidth: '320px', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Record a short video of yourself. We&apos;ll create a digital version of you that can star in any movie you imagine.
        </p>
        <button
          type="button"
          onClick={() => { setError(null); setPhase('twin_record') }}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: '1rem', padding: '1rem 2.5rem', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}
        >
          📷 Record My Twin
        </button>
        {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '1rem' }}>{error}</p>}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TWIN RECORD
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'twin_record') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
        {authButton}
        <video
          ref={previewRef}
          autoPlay muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '100%', padding: '4rem 2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: '1.25rem', fontWeight: 300, opacity: 0.9 }}>
              {isRecording ? 'Look at the camera and speak naturally...' : 'Get ready to record your digital twin'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            {isRecording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '1rem' }}>
                  {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')} / {String(Math.floor(MAX_RECORD_SECONDS / 60)).padStart(2, '0')}:{String(MAX_RECORD_SECONDS % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={isRecording ? stopRecording : () => void startRecording()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem 2.5rem', borderRadius: '9999px', border: 'none',
                background: isRecording ? '#dc2626' : 'white',
                color: isRecording ? 'white' : 'black',
                fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              {isRecording
                ? <><span style={{ width: '12px', height: '12px', background: 'white', borderRadius: '2px', display: 'inline-block' }} /> Stop</>
                : <><span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', display: 'inline-block' }} /> Record</>
              }
            </button>

            {!isRecording && (
              <button type="button" onClick={() => setPhase('twin_intro')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer' }}>
                ← Back
              </button>
            )}

            {error && <p style={{ color: '#f87171', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TWIN PROCESSING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'twin_processing') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>{step || 'Creating your digital twin...'}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>This takes about 30 seconds</p>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: STORY INPUT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'story_input') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {authButton}
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Twin thumbnail */}
          {twinFrameUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <img
                src={twinFrameUrl}
                alt="Your digital twin"
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }}
              />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Your Digital Twin ✅</p>
                <button type="button" onClick={resetTwin} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}>
                  Re-record twin
                </button>
              </div>
            </div>
          )}

          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🎬 Create Your Movie</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Tell your story in up to 200 characters</p>

          <textarea
            value={story}
            onChange={e => setStory(e.target.value.slice(0, 200))}
            rows={4}
            placeholder="A detective discovers a hidden message in an old painting..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.75rem', padding: '1rem', color: 'white', fontSize: '0.95rem',
              resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem',
            }}
          />
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', textAlign: 'right', marginBottom: '1.5rem' }}>
            {story.length}/200
          </p>

          {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <button
            type="button"
            onClick={() => void generateMovie()}
            disabled={!story.trim()}
            style={{
              width: '100%', padding: '1rem', borderRadius: '1rem', border: 'none',
              background: story.trim() ? '#7c3aed' : 'rgba(255,255,255,0.1)',
              color: 'white', fontSize: '1rem', fontWeight: 'bold',
              cursor: story.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            ✨ Generate My Movie
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: MOVIE PROCESSING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'movie_processing') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a855f7', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', textAlign: 'center', maxWidth: '280px' }}>{step || 'Generating your movie...'}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>This takes 3–5 minutes</p>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {authButton}
      {videoUrl && (
        <video
          ref={resultRef}
          src={videoUrl}
          playsInline autoPlay controls
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.75rem', zIndex: 10 }}>
        {videoUrl && (
          <a
            href={videoUrl}
            download="my-movie.mp4"
            style={{ padding: '0.6rem 1.25rem', borderRadius: '9999px', background: 'rgba(124,58,237,0.8)', color: 'white', fontSize: '0.875rem', textDecoration: 'none' }}
          >
            ⬇️ Download
          </a>
        )}
        <button
          type="button"
          onClick={() => { setVideoUrl(null); setStory(''); setError(null); setPhase('story_input') }}
          style={{ padding: '0.6rem 1.25rem', borderRadius: '9999px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          🎬 Make Another
        </button>
      </div>
    </div>
  )
}
