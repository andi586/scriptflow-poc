'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PACKAGES = [
  { id: 'pack_3', credits: 3, price: 12.9, name: '3 Movies', popular: false },
  { id: 'pack_5', credits: 5, price: 19.9, name: '5 Movies', popular: true },
  { id: 'pack_10', credits: 10, price: 34.9, name: '10 Movies', popular: false }
]

export default function CreditsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams?.get('success')

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user?.id) {
        setUserId(session.user.id)
        
        // Fetch user credits
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          setUserCredits(profile.credits || 0)
        }
      } else {
        // Anonymous user - generate or retrieve guest ID
        let guestId = localStorage.getItem('guestId')
        if (!guestId) {
          guestId = crypto.randomUUID()
          localStorage.setItem('guestId', guestId)
        }
        setUserId(guestId)
      }
    }
    getUser()
  }, [])

  const handlePurchase = async (packageId: string) => {
    if (loading) return
    
    setLoading(packageId)
    
    try {
      const res = await fetch('/api/stripe/credit-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, userId })
      })
      
      const data = await res.json()
      
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert('Payment error: ' + (data.error || 'Unknown error'))
        setLoading(null)
      }
    } catch (error) {
      console.error('Purchase error:', error)
      alert('Failed to initiate purchase')
      setLoading(null)
    }
  }

  return (
    <div style={{
      background: '#0a0a0a',
      minHeight: '100vh',
      color: 'white',
      padding: '48px 20px',
      fontFamily: 'system-ui'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ color: '#D4A853', fontSize: '2rem', marginBottom: '12px' }}>
          🎬 Buy Movie Credits
        </h1>
        <p style={{ color: '#888', fontSize: '1rem', marginBottom: '24px' }}>
          Purchase credits to create multiple movies at a discounted rate
        </p>
        
        {/* Current Credits */}
        <div style={{
          display: 'inline-block',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '12px',
          padding: '12px 24px',
          marginBottom: '24px'
        }}>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>Your Credits: </span>
          <span style={{ color: '#D4A853', fontSize: '1.2rem', fontWeight: '700' }}>
            {userCredits}
          </span>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            background: '#1a3a1a',
            border: '1px solid #4ade80',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            color: '#4ade80'
          }}>
            ✅ Credits purchased successfully! Refresh to see your updated balance.
          </div>
        )}
      </div>

      {/* Packages Grid */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '48px'
      }}>
        {PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            style={{
              background: pkg.popular ? 'linear-gradient(135deg, #1a1a1a 0%, #2a2410 100%)' : '#1a1a1a',
              border: pkg.popular ? '2px solid #D4A853' : '1px solid #333',
              borderRadius: '16px',
              padding: '32px 24px',
              position: 'relative',
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {/* Popular Badge */}
            {pkg.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#D4A853',
                color: '#000',
                padding: '4px 16px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '700'
              }}>
                MOST POPULAR
              </div>
            )}

            {/* Package Info */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: '#D4A853', fontSize: '1.5rem', marginBottom: '8px' }}>
                {pkg.name}
              </h3>
              <div style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '8px' }}>
                {pkg.credits}
              </div>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '16px' }}>
                movie credits
              </p>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#D4A853' }}>
                ${pkg.price}
              </div>
              <p style={{ color: '#666', fontSize: '0.8rem', marginTop: '4px' }}>
                ${(pkg.price / pkg.credits).toFixed(2)} per movie
              </p>
            </div>

            {/* Buy Button */}
            <button
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading === pkg.id}
              style={{
                width: '100%',
                background: pkg.popular ? '#D4A853' : '#333',
                color: pkg.popular ? '#000' : '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading === pkg.id ? 'not-allowed' : 'pointer',
                opacity: loading === pkg.id ? 0.6 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (loading !== pkg.id) {
                  e.currentTarget.style.opacity = '0.8'
                }
              }}
              onMouseLeave={(e) => {
                if (loading !== pkg.id) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
            >
              {loading === pkg.id ? '⏳ Processing...' : '🎬 Buy Now'}
            </button>
          </div>
        ))}
      </div>

      {/* Back Button */}
      <div style={{ textAlign: 'center' }}>
        <a
          href="/create"
          style={{
            display: 'inline-block',
            color: '#888',
            textDecoration: 'none',
            padding: '12px 24px',
            border: '1px solid #333',
            borderRadius: '100px',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D4A853'
            e.currentTarget.style.color = '#D4A853'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333'
            e.currentTarget.style.color = '#888'
          }}
        >
          ← Back to Create
        </a>
      </div>
    </div>
  )
}
