'use client'

const FIXED_COSTS = [
  { name: 'Vercel Pro', monthly: 20 },
  { name: 'Railway FFmpeg', monthly: 5 },
  { name: 'Supabase', monthly: 25 },
  { name: 'Anthropic API (Claude)', monthly: 10 },
]

const TIERS = [
  { name: '30s', shots: 4, duration: 3, price: 9.99 },
  { name: '60s', shots: 6, duration: 2, price: 19.99 },
  { name: '90s', shots: 9, duration: 2, price: 29.99 },
]

const KLING_RATE = 0.15 // $ per second

const SURVIVAL = [
  { label: 'Break-even', videos: 4, color: '#ef4444' },
  { label: 'Comfortable', videos: 10, color: '#f59e0b' },
  { label: 'Good', videos: 30, color: '#22c55e' },
  { label: 'Great', videos: 100, color: '#D4A853' },
]

export default function CostDashboard() {
  const totalFixed = FIXED_COSTS.reduce((s, c) => s + c.monthly, 0)

  const tiersWithMargin = TIERS.map(t => {
    const cost = t.shots * t.duration * KLING_RATE
    const margin = t.price - cost
    const marginPct = Math.round((margin / t.price) * 100)
    return { ...t, cost, margin, marginPct }
  })

  const avgRevenue = tiersWithMargin[1].price
  const avgCost = tiersWithMargin[1].cost
  const contributionMargin = avgRevenue - avgCost
  const breakEven = Math.ceil(totalFixed / contributionMargin)

  const survivalWithProfit = SURVIVAL.map(s => ({
    ...s,
    profit: Math.round(s.videos * contributionMargin - totalFixed),
  }))

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px' }}>💰 Cost Dashboard</h1>
        <p style={{ color: '#666', marginBottom: '48px' }}>ScriptFlow · Heaven Cinema Production</p>

        {/* Fixed Costs */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#D4A853', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Fixed Monthly Costs
          </h2>
          <div style={{ background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
            {FIXED_COSTS.map((c, i) => (
              <div key={c.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 24px', borderBottom: i < FIXED_COSTS.length - 1 ? '1px solid #1a1a1a' : 'none'
              }}>
                <span style={{ color: '#ccc' }}>{c.name}</span>
                <span style={{ color: '#ef4444', fontWeight: '700' }}>${c.monthly}/mo</span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 24px', background: '#1a1a1a', borderTop: '2px solid #333'
            }}>
              <span style={{ fontWeight: '800', color: '#fff' }}>Total Fixed</span>
              <span style={{ color: '#ef4444', fontWeight: '800', fontSize: '1.2rem' }}>${totalFixed}/mo</span>
            </div>
          </div>
        </section>

        {/* Variable Costs & Margins */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#D4A853', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Pricing & Margins
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#1a1a1a' }}>
                  {['Tier', 'Shots', 'Cost', 'Price', 'Margin', 'Margin %'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tiersWithMargin.map((t, i) => (
                  <tr key={t.name} style={{ borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
                    <td style={{ padding: '16px 20px', fontWeight: '700', color: '#D4A853' }}>{t.name}</td>
                    <td style={{ padding: '16px 20px', color: '#888' }}>{t.shots} × {t.duration}s</td>
                    <td style={{ padding: '16px 20px', color: '#ef4444', fontWeight: '600' }}>${t.cost.toFixed(2)}</td>
                    <td style={{ padding: '16px 20px', color: '#fff', fontWeight: '700' }}>${t.price}</td>
                    <td style={{ padding: '16px 20px', color: '#22c55e', fontWeight: '700' }}>${t.margin.toFixed(2)}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        background: '#052e16', color: '#22c55e', padding: '4px 10px',
                        borderRadius: '100px', fontSize: '0.85rem', fontWeight: '700'
                      }}>{t.marginPct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Break-even */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#D4A853', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Break-even Calculator
          </h2>
          <div style={{ background: '#111', borderRadius: '12px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
            <div>
              <div style={{ color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Fixed Costs</div>
              <div style={{ color: '#ef4444', fontSize: '1.8rem', fontWeight: '800' }}>${totalFixed}</div>
              <div style={{ color: '#555', fontSize: '0.8rem' }}>per month</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Avg Revenue (60s)</div>
              <div style={{ color: '#D4A853', fontSize: '1.8rem', fontWeight: '800' }}>${avgRevenue}</div>
              <div style={{ color: '#555', fontSize: '0.8rem' }}>per video</div>
            </div>
            <div>
              <div style={{ color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Contribution Margin</div>
              <div style={{ color: '#22c55e', fontSize: '1.8rem', fontWeight: '800' }}>${contributionMargin.toFixed(2)}</div>
              <div style={{ color: '#555', fontSize: '0.8rem' }}>per video</div>
            </div>
            <div style={{ background: '#1a0a0a', borderRadius: '8px', padding: '16px', border: '1px solid #ef4444' }}>
              <div style={{ color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Break-even</div>
              <div style={{ color: '#ef4444', fontSize: '2.4rem', fontWeight: '800' }}>{breakEven}</div>
              <div style={{ color: '#555', fontSize: '0.8rem' }}>videos / month</div>
            </div>
          </div>
        </section>

        {/* Survival Line */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#D4A853', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Survival Line
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {survivalWithProfit.map(s => (
              <div key={s.label} style={{
                background: '#111', borderRadius: '12px', padding: '24px',
                borderTop: `3px solid ${s.color}`
              }}>
                <div style={{ color: s.color, fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  {s.label}
                </div>
                <div style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '4px' }}>
                  {s.videos}
                </div>
                <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: '12px' }}>videos / month</div>
                <div style={{ color: s.profit >= 0 ? '#22c55e' : '#ef4444', fontWeight: '700', fontSize: '1.1rem' }}>
                  {s.profit >= 0 ? '+' : ''}{s.profit >= 0 ? `$${s.profit}` : `-$${Math.abs(s.profit)}`} profit
                </div>
              </div>
            ))}
          </div>
        </section>

        <p style={{ color: '#333', fontSize: '0.8rem', textAlign: 'center' }}>
          Kling rate: ${KLING_RATE}/sec · Calculations based on 60s tier average
        </p>

      </div>
    </div>
  )
}
