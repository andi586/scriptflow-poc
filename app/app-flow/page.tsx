'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Constants ────────────────────────────────────────────────────────────────
const TWIN_ID_KEY = 'sf_twin_id'
const TWIN_FRAME_KEY = 'sf_twin_frame'
const SESSION_ID_KEY = 'sf_session_id'
const MAX_RECORD_SECONDS = 60

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

// ─── Emotion Templates ────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'dear_mom',        emoji: '💌', title: 'Dear Mom',                  preview: 'Mom, I never told you this...',         featured: true },
  { id: 'let_them_go',     emoji: '💔', title: 'Let Them Go',               preview: 'I kept holding on... but I\'m done.',   featured: false },
  { id: 'younger_self',    emoji: '🌙', title: 'Letter to My Younger Self', preview: 'Hey... it\'s going to be okay.',         featured: false },
  { id: 'deserve_better',  emoji: '👑', title: 'I Deserve Better',          preview: 'I used to beg for the bare minimum.',   featured: false },
  { id: 'never_said',      emoji: '🕰', title: 'Things I Never Said',       preview: 'There\'s so much I kept inside...',     featured: false },
  { id: 'love_myself',     emoji: '✨', title: 'I Finally Love Myself',     preview: 'I used to hate what I saw in the mirror.', featured: false },
]

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading'
  | 'twin_intro'
  | 'twin_record'
  | 'twin_processing'
  | 'template_select'   // NEW: pick emotion template
  | 'template_confirm'  // NEW: add personal note + create
  | 'director_mode'     // Advanced: free-text story
  | 'movie_processing'
  | 'result'

// ─── Processing steps ─────────────────────────────────────────────────────────
const PROCESSING_STEPS = [
  '🧠 Writing your words...',
  '🎙 Giving you a voice...',
  '🎭 Bringing you to life...',
  '🎬 Building your scene...',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function AppFlowPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [twinId, setTwinId] = useState<string | null>(null)
  const [twinFrameUrl, setTwinFrameUrl] = useState<string | null>(null)

  // photo upload state
  const [uploading, setUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // template mode
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null)
  const [personalNote, setPersonalNote] = useState('')

  // director mode (advanced)
  const [story, setStory] = useState('')

  const [processingStep, setProcessingStep] = useState(0)
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

  // ── Upload photo to create digital twin ────────────────────────────────────
  const handlePhotoUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const filePath = `twins/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('recordings')
        .upload(filePath, file, { contentType: file.type, upsert: true })
      if (uploadErr) throw new Error('Photo upload failed: ' + uploadErr.message)
      const url = supabase.storage.from('recordings').getPublicUrl(uploadData.path).data.publicUrl
      setPhotoUrl(url)

      // Create digital twin record
      const userId = crypto.randomUUID()
      const { data: twin, error: twinErr } = await supabase
        .from('digital_twins')
        .insert({
          user_id: userId,
          frame_url_mid: url,
          source_video_url: null,
          is_active: true,
        })
        .select()
        .single()
      if (twinErr) throw new Error('Twin creation failed: ' + twinErr.message)

      localStorage.setItem(TWIN_ID_KEY, twin.id)
      localStorage.setItem('twinId', twin.id)
      localStorage.setItem(TWIN_FRAME_KEY, url)
      setTwinId(twin.id)
      setTwinFrameUrl(url)
      setPhase('template_select')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  // ── On mount: check for existing twin ─────────────────────────────────────
  useEffect(() => {
    const storedTwinId = localStorage.getItem(TWIN_ID_KEY)
    const storedFrame = localStorage.getItem(TWIN_FRAME_KEY)
    if (storedTwinId && storedFrame) {
      setTwinId(storedTwinId)
      setTwinFrameUrl(storedFrame)
      setPhase('template_select')
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

  // ── Cycle processing steps ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'movie_processing') return
    setProcessingStep(0)
    let idx = 0
    const t = setInterval(() => {
      idx = Math.min(idx + 1, PROCESSING_STEPS.length - 1)
      setProcessingStep(idx)
    }, 18000) // ~18s per step
    return () => clearInterval(t)
  }, [phase])

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
    try {
      const mime = blob.type || 'video/webm'
      const ext = mime.includes('mp4') ? 'mp4' : 'webm'
      const videoUrl = await uploadBlob(blob, `twin_${Date.now()}.${ext}`)
      if (!videoUrl) throw new Error('Upload failed')

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
      setPhase('template_select')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Twin creation failed')
      setPhase('twin_record')
    }
  }, [uploadBlob])

  // ── Generate movie (template mode) ────────────────────────────────────────
  const [processingMessage, setProcessingMessage] = useState<string | null>(null)

  const generateFromTemplate = useCallback(async () => {
    console.log('[app-flow] twinId state:', twinId)
    console.log('[app-flow] localStorage twinId:', localStorage.getItem('twinId'))
    console.log('[app-flow] localStorage TWIN_ID_KEY:', localStorage.getItem(TWIN_ID_KEY))

    const currentTwinId = twinId
      || localStorage.getItem('twinId')
      || localStorage.getItem(TWIN_ID_KEY)

    console.log('[app-flow] currentTwinId:', currentTwinId)

    if (!currentTwinId) {
      alert('Please upload your photo first')
      return
    }
    if (!selectedTemplate) return
    setPhase('movie_processing')
    setProcessingMessage(null)
    setError(null)

    try {
      // Step 1: Generate script via Anthropic
      console.log('[app-flow] calling generate-script...')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const scriptRes = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: selectedTemplate.title, personalNote: personalNote.trim() || undefined }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const scriptData = await scriptRes.json()
      if (!scriptRes.ok) throw new Error(scriptData.error ?? 'Script generation failed')

      // Support both shots array (new) and legacy script string
      const shots = scriptData.shots ?? null
      const script: string = scriptData.script ?? (shots ? shots.map((s: { text: string }) => s.text).join(' ') : '')

      if (!script && !shots) throw new Error('Script generation failed')

      // Step 2: Submit to movie/generate
      const resolvedTwinId = twinId
        || localStorage.getItem('twinId')
        || localStorage.getItem('scriptflow_twin_id')
        || localStorage.getItem(TWIN_ID_KEY)

      console.log('[app-flow] twinId state:', twinId)
      console.log('[app-flow] currentTwinId resolved:', resolvedTwinId)
      console.log('[app-flow] calling movie/generate with userId:', resolvedTwinId)

      const sessionId = getOrCreateSessionId()
      const res = await fetch('/api/movie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: script, tier: '60s', userId: resolvedTwinId, sessionId, template: selectedTemplate.title, shots }),
      })
      const data = await res.json()

      if (shots && data.movieId) {
        // Multi-shot path: show processing message, no polling needed yet
        setProcessingMessage(`🎬 Generating your ${data.totalShots}-shot movie...`)
        return
      }

      if (!res.ok || !data.taskId) throw new Error(data.error ?? 'Movie generation failed')

      const taskId: string = data.taskId
      startPolling(taskId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setPhase('template_confirm')
    }
  }, [twinId, selectedTemplate, personalNote])

  // ── Generate movie (director mode) ────────────────────────────────────────
  const generateFromDirector = useCallback(async () => {
    if (!twinId || !story.trim()) return
    setPhase('movie_processing')
    setError(null)

    try {
      const sessionId = getOrCreateSessionId()
      const res = await fetch('/api/movie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: story.trim(), sessionId }),
      })
      const data = await res.json()
      if (!res.ok || !data.taskId) throw new Error(data.error ?? 'Movie generation failed')
      startPolling(data.taskId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Movie generation failed')
      setPhase('director_mode')
    }
  }, [twinId, story])

  // ── Shared polling logic ───────────────────────────────────────────────────
  const startPolling = useCallback((taskId: string) => {
    let attempt = 0
    const MAX_POLL = 120
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    pollIntervalRef.current = setInterval(async () => {
      attempt++
      try {
        const pollRes = await fetch(`/api/omni-human/poll?taskId=${taskId}`)
        const pollData = await pollRes.json()

        if (pollData.status === 'kling_processing' && pollData.klingTaskId) {
          clearInterval(pollIntervalRef.current!)
          let klingAttempt = 0
          pollIntervalRef.current = setInterval(async () => {
            klingAttempt++
            try {
              const kr = await fetch(`/api/kling-poll?taskId=${pollData.klingTaskId}`)
              const kd = await kr.json()
              if (kd.status === 'completed' && kd.videoUrl) {
                clearInterval(pollIntervalRef.current!)
                setVideoUrl(kd.videoUrl)
                setPhase('result')
              } else if (kd.status === 'failed') {
                clearInterval(pollIntervalRef.current!)
                setError('Scene generation failed')
                setPhase('template_select')
              }
            } catch {}
            if (klingAttempt >= MAX_POLL) {
              clearInterval(pollIntervalRef.current!)
              setError('Timed out waiting for scene generation')
              setPhase('template_select')
            }
          }, 5000)
        } else if (pollData.status === 'completed' && pollData.videoUrl) {
          clearInterval(pollIntervalRef.current!)
          setVideoUrl(pollData.videoUrl)
          setPhase('result')
        } else if (pollData.status === 'failed') {
          clearInterval(pollIntervalRef.current!)
          setError('Video generation failed')
          setPhase('template_select')
        }
      } catch {}

      if (attempt >= MAX_POLL) {
        clearInterval(pollIntervalRef.current!)
        setError('Timed out waiting for video generation')
        setPhase('template_select')
      }
    }, 5000)
  }, [])

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

  const myVideosButton = (
    <a
      href="/my-videos"
      style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 200, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-block' }}
    >
      🎬 My Videos
    </a>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: LOADING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TWIN INTRO — photo upload step
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'twin_intro') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        {authButton}
        {myVideosButton}

        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em' }}>
          First, let&apos;s capture your face
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem', maxWidth: '300px', marginBottom: '40px', lineHeight: 1.6 }}>
          Upload a clear photo of your face
        </p>

        {/* Photo preview */}
        {photoUrl && (
          <img src={photoUrl} alt="Your photo" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #D4A853', marginBottom: '24px' }} />
        )}

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void handlePhotoUpload(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: uploading ? 'rgba(212,168,83,0.4)' : '#D4A853',
            color: '#000', border: 'none', borderRadius: '100px',
            padding: '18px 48px', fontSize: '1rem', fontWeight: '800',
            cursor: uploading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em',
            marginBottom: '16px',
          }}
        >
          {uploading ? 'Uploading...' : '📷 Upload My Photo'}
        </button>

        <button
          type="button"
          onClick={() => { setError(null); setPhase('twin_record') }}
          style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Or record a video instead →
        </button>

        {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginTop: '16px' }}>{error}</p>}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
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
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem' }}>Creating your digital twin...</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>This takes about 30 seconds</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TEMPLATE SELECT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'template_select') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', padding: '0 0 4rem' }}>
        {authButton}
        {myVideosButton}

        {/* Header */}
        <div style={{ padding: '4rem 1.5rem 1.5rem', textAlign: 'center' }}>
          {twinFrameUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <img src={twinFrameUrl} alt="twin" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #7c3aed' }} />
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Your twin is ready ✅</span>
              <button type="button" onClick={resetTwin} style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}>re-record</button>
            </div>
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>What do you want to say?</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>Choose an emotion template</p>
        </div>

        {/* Template grid */}
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setSelectedTemplate(t); setPersonalNote(''); setPhase('template_confirm') }}
              style={{
                background: t.featured ? 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' : 'rgba(255,255,255,0.05)',
                border: t.featured ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '1rem',
                padding: '1rem 0.875rem',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'white',
                position: 'relative',
              }}
            >
              {t.featured && (
                <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.6rem', background: 'rgba(255,255,255,0.25)', borderRadius: '9999px', padding: '0.15rem 0.4rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  FEATURED
                </span>
              )}
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{t.emoji}</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem', lineHeight: 1.2 }}>{t.title}</div>
              <div style={{ fontSize: '0.7rem', color: t.featured ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{t.preview}</div>
            </button>
          ))}
        </div>

        {error && <p style={{ color: '#f87171', fontSize: '0.875rem', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}

        {/* Advanced mode link */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => { setStory(''); setError(null); setPhase('director_mode') }}
            style={{ color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Advanced Mode →
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: TEMPLATE CONFIRM
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'template_confirm') {
    const t = selectedTemplate!
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {authButton}

        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Back */}
          <button type="button" onClick={() => setPhase('template_select')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '1.5rem', padding: 0 }}>
            ← Back
          </button>

          {/* Selected template badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
            <span style={{ fontSize: '2rem' }}>{t.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{t.preview}</div>
            </div>
          </div>

          {/* Personal note */}
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
            Add a personal touch <span style={{ color: 'rgba(255,255,255,0.25)' }}>(optional)</span>
          </label>
          <textarea
            value={personalNote}
            onChange={e => setPersonalNote(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="e.g. She sacrificed everything for me"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.75rem', padding: '0.875rem', color: 'white', fontSize: '0.9rem',
              resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '1.5rem',
            }}
          />

          {error && <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

          <button
            type="button"
            onClick={() => void generateFromTemplate()}
            style={{
              width: '100%', padding: '1rem', borderRadius: '1rem', border: 'none',
              background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
              color: 'white', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            ✨ Create My Video
          </button>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: DIRECTOR MODE (Advanced)
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'director_mode') {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        {authButton}
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <button type="button" onClick={() => setPhase('template_select')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '1.5rem', padding: 0 }}>
            ← Back
          </button>

          <h1 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>🎬 Director Mode</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Write your own story (up to 200 characters)</p>

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
            onClick={() => void generateFromDirector()}
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1rem', textAlign: 'center', maxWidth: '280px', fontWeight: 500 }}>
          {PROCESSING_STEPS[processingStep]}
        </p>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {PROCESSING_STEPS.map((_, i) => (
            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i <= processingStep ? '#a855f7' : 'rgba(255,255,255,0.15)', transition: 'background 0.4s' }} />
          ))}
        </div>
        {processingMessage && (
          <p style={{ color: '#a855f7', fontSize: '0.9rem', textAlign: 'center', maxWidth: '280px', fontWeight: 600 }}>
            {processingMessage}
          </p>
        )}
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>This takes 3–5 minutes</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          onClick={() => { setVideoUrl(null); setSelectedTemplate(null); setPersonalNote(''); setError(null); setPhase('template_select') }}
          style={{ padding: '0.6rem 1.25rem', borderRadius: '9999px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          🎬 Make Another
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
