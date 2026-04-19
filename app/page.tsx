'use client'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

      {/* HERO */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', padding: '40px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', fontWeight: '800', lineHeight: 1.1, marginBottom: '24px' }}>
          You Are<br/>
          <span style={{ color: '#D4A853' }}>the Star</span>
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 3vw, 1.4rem)', color: '#aaa', maxWidth: '600px', marginBottom: '48px', lineHeight: 1.6 }}>
          Upload your photo. Tell your story.<br/>
          Become the lead in your own movie.
        </p>
        <button
          onClick={() => router.push('/app-flow')}
          style={{
            background: '#D4A853', color: '#000', border: 'none',
            padding: '20px 48px', fontSize: '1.2rem', fontWeight: '800',
            borderRadius: '100px', cursor: 'pointer', letterSpacing: '0.5px'
          }}
        >
          Create My Movie →
        </button>
        <p style={{ color: '#555', marginTop: '16px', fontSize: '0.9rem' }}>
          No experience needed. Ready in minutes.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 20px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '60px', color: '#fff' }}>
          How It Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px' }}>
          {[
            { step: '01', title: 'Upload Your Photo', desc: 'One photo is all we need to put you in the movie.' },
            { step: '02', title: 'Tell Your Story', desc: 'One sentence. Your memory, your dream, your message.' },
            { step: '03', title: 'Get Your Movie', desc: 'A cinematic short film starring you. Ready in minutes.' }
          ].map(item => (
            <div key={item.step} style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '3rem', color: '#D4A853', fontWeight: '800', marginBottom: '16px' }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: '#fff' }}>{item.title}</h3>
              <p style={{ color: '#888', lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAMPLE VIDEO */}
      <section style={{ padding: '80px 20px', textAlign: 'center', background: '#111' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>See What&apos;s Possible</h2>
        <p style={{ color: '#888', marginBottom: '40px' }}>Real AI movie. Real person. Generated in minutes.</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <video
            src="https://storage.theapi.app/videos/308546206302979.mp4"
            autoPlay
            muted
            loop
            playsInline
            style={{ maxHeight: '600px', maxWidth: '340px', borderRadius: '16px', boxShadow: '0 0 60px rgba(212,168,83,0.3)' }}
          />
        </div>
        <p style={{ color: '#555', marginTop: '20px', fontSize: '0.9rem' }}>
          Your face. Your voice. Your story.
        </p>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: '100px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '24px', fontWeight: '800' }}>
          Your Story Deserves<br/>
          <span style={{ color: '#D4A853' }}>to Be Seen</span>
        </h2>
        <p style={{ color: '#888', marginBottom: '48px', fontSize: '1.1rem' }}>
          Join thousands of people telling their stories through AI cinema.
        </p>
        <button
          onClick={() => router.push('/app-flow')}
          style={{
            background: '#D4A853', color: '#000', border: 'none',
            padding: '20px 48px', fontSize: '1.2rem', fontWeight: '800',
            borderRadius: '100px', cursor: 'pointer'
          }}
        >
          Start Creating Free →
        </button>
        <p style={{ color: '#333', marginTop: '60px', fontSize: '0.85rem' }}>
          © 2026 ScriptFlow · heavencinema.ai
        </p>
      </section>

    </main>
  )
}
