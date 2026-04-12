'use client'

import { useState, useEffect, useCallback } from 'react'

const SERVICES = [
  { name: 'PiAPI/Kling', key: 'piapi', warning: 10, currency: 'points' },
  { name: 'ElevenLabs', key: 'elevenlabs', warning: 1000, currency: 'credits' },
  { name: 'Supabase', key: 'supabase', warning: 25, currency: '$', manual: true },
  { name: 'Railway', key: 'railway', warning: 10, currency: '$', manual: true },
  { name: 'Vercel', key: 'vercel', warning: 10, currency: '$', manual: true },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StatusBadge({ result, warning }: { result: any; warning: number }) {
  if (!result) return <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>—</span>
  if (result.error) return <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>Error</span>
  if (result.manual) return <span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>Manual</span>
  const balance = result.balance ?? -1
  if (balance < 0) return <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Unknown</span>
  if (balance < warning * 0.5) return <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>🔴 Critical</span>
  if (balance < warning) return <span style={{ background: '#78350f', color: '#fcd34d', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>🟡 Warning</span>
  return <span style={{ background: '#14532d', color: '#86efac', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem' }}>✅ OK</span>
}

export default function CostsDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/check-costs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>💰 Cost Monitor</h1>
            {data?.lastChecked && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                Last checked: {new Date(data.lastChecked).toLocaleString()}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '⏳ Checking...' : '🔄 Refresh'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', color: '#fca5a5', fontSize: '0.875rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Service cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {SERVICES.map(svc => {
            const result = data?.[svc.key] ?? (svc.manual ? { manual: true } : null)
            const balance = result?.balance
            return (
              <div key={svc.key} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{svc.name}</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                    {result?.error
                      ? result.error
                      : result?.manual
                        ? `Check manually — threshold: ${svc.warning} ${svc.currency}`
                        : balance != null
                          ? `${typeof balance === 'number' ? balance.toLocaleString() : balance} ${svc.currency} remaining`
                          : loading ? 'Checking...' : 'No data'
                    }
                    {result?.used != null && result?.limit != null && (
                      <span> ({result.used.toLocaleString()} / {result.limit.toLocaleString()} used)</span>
                    )}
                  </p>
                </div>
                <StatusBadge result={result} warning={svc.warning} />
              </div>
            )
          })}
        </div>

        {/* Raw JSON toggle */}
        {data && (
          <details style={{ marginTop: '2rem' }}>
            <summary style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
              Raw API response
            </summary>
            <pre style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}

        <p style={{ marginTop: '2rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', textAlign: 'center' }}>
          Daily cron runs at 9:00 AM UTC · Supabase / Railway / Vercel require manual checks
        </p>
      </div>
    </div>
  )
}
