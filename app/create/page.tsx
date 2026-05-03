"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CharacterPhoto {
  file: File | null;
  url: string | null;
}

const TEMPLATES = [
  {
    id: "parallel_universe",
    title: "Your Parallel Life",
    emoji: "🌌",
    outcome: "Watch yourself living a completely different life",
    story: "You see another version of yourself living a different life. You watch them with longing. The final moment: you realize what could have been."
  },
  {
    id: "she_didnt_choose_you", 
    title: "She Didn't Choose You",
    emoji: "💔",
    outcome: "Watch yourself in a cinematic breakup scene",
    story: "You prepare to confess your feelings. She walks toward someone else. Her smile breaks your heart."
  },
  {
    id: "future_you",
    title: "Your Future Self Visits",
    emoji: "✨",
    outcome: "Watch a stronger version of you deliver a message",
    story: "A stronger, wiser version of you appears. They look at you with knowing eyes. They say one thing before disappearing."
  },
  {
    id: "lost_someone",
    title: "You Lost Them",
    emoji: "🕯️",
    outcome: "Watch yourself process grief and memory",
    story: "Flashes of memory with someone important. They slowly fade away. You are left alone with the echo of what was."
  },
  {
    id: "last_person",
    title: "The Last Person on Earth",
    emoji: "🌍",
    outcome: "Watch yourself search an empty world",
    story: "You walk through an empty world. You search for someone, anyone. Silence is the only response."
  }
];

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>(
    Array(6).fill(null).map(() => ({ file: null, url: null }))
  );
  const [story, setStory] = useState(TEMPLATES[0].story);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
          guestId = crypto.randomUUID();
          localStorage.setItem('guestId', guestId);
        }
        setUserId(guestId);
      }
    };
    getUser();
  }, []);

  const handleMainPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMainPhoto({ file, url: URL.createObjectURL(file) });
    setError(null);
  };

  const handleTemplateClick = (template: typeof TEMPLATES[0]) => {
    setStory(template.story);
    setSelectedTemplate(template.id);
  };

  const handleGenerate = async () => {
    if (loading) return;
    
    if (!mainPhoto.file) {
      setError("Please upload your photo");
      return;
    }

    if (!selectedTemplate) {
      setError("Please choose your story");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Upload main photo
      const mainFormData = new FormData();
      mainFormData.append('file', mainPhoto.file);
      const mainUploadRes = await fetch('/api/upload-photo', { 
        method: 'POST', 
        body: mainFormData 
      });
      const mainUploadData = await mainUploadRes.json();
      const mainPhotoUrl = mainUploadData.url;
      
      if (!mainPhotoUrl) throw new Error('Failed to upload main photo');
      
      // Upload extra photos
      const additionalImages: string[] = [];
      for (const photo of extraPhotos) {
        if (photo.file) {
          const form = new FormData();
          form.append('file', photo.file);
          const res = await fetch('/api/upload-photo', { 
            method: 'POST', 
            body: form 
          });
          const data = await res.json();
          if (data.url) {
            additionalImages.push(data.url);
          }
        }
      }
      
      // Generate movie
      const body = {
        story,
        tier: "30s",
        userId: userId || crypto.randomUUID(),
        main_photo_url: mainPhotoUrl,
        additional_images: additionalImages
      };
      
      const res = await fetch("/api/movie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to create movie");
      if (!data.movieId) throw new Error("No movie ID returned");
      
      router.push(`/movie/${data.movieId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const step1Complete = !!mainPhoto.file;
  const step2Complete = !!selectedTemplate;
  const canGenerate = step1Complete && step2Complete;

  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      fontFamily: 'system-ui',
      position: 'relative'
    }}>
      {/* My Videos Button */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px',
        zIndex: 100
      }}>
        <a 
          href="/my-videos" 
          style={{ 
            color: '#888', 
            fontSize: '0.85rem', 
            textDecoration: 'none', 
            padding: '8px 16px', 
            border: '1px solid #333', 
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#D4A853';
            e.currentTarget.style.color = '#D4A853';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.color = '#888';
          }}
        >
          📁 My Videos
        </a>
      </div>

      {/* Desktop: 2-Column Layout */}
      <div style={{ 
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'row'
      }}
      className="flex-col md:flex-row"
      >
        
        {/* LEFT PANEL: Upload Photo (40%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid #1a1a1a',
          position: 'sticky',
          top: 0,
          height: '100vh'
        }}
        className="md:w-2/5 md:sticky md:top-0 md:h-screen"
        >
          <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
            <p style={{ 
              color: '#666', 
              fontSize: '0.85rem', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Step 1 of 2
            </p>
            
            <h2 style={{ 
              margin: '0 0 24px 0', 
              fontSize: '2rem', 
              fontWeight: '700',
              color: '#fff'
            }}>
              Upload Your Photo
            </h2>

            <input
              ref={mainPhotoRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleMainPhotoChange}
              style={{ display: 'none' }}
            />
            
            <div
              onClick={() => mainPhotoRef.current?.click()}
              style={{
                cursor: 'pointer',
                width: '100%',
                aspectRatio: '3/4',
                borderRadius: '20px',
                background: mainPhoto.url ? `url(${mainPhoto.url})` : '#111',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: mainPhoto.url ? '3px solid #D4A853' : '3px dashed #333',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!mainPhoto.url) {
                  e.currentTarget.style.borderColor = '#D4A853';
                }
              }}
              onMouseLeave={(e) => {
                if (!mainPhoto.url) {
                  e.currentTarget.style.borderColor = '#333';
                }
              }}
            >
              {!mainPhoto.url && (
                <>
                  <div style={{ fontSize: '5rem', marginBottom: '16px' }}>📷</div>
                  <p style={{ color: '#D4A853', fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
                    Click to upload
                  </p>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>
                    JPG, PNG, or WEBP
                  </p>
                </>
              )}
              {mainPhoto.url && (
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.9)',
                  padding: '10px 20px',
                  borderRadius: '25px',
                  fontSize: '0.9rem',
                  color: '#4ade80',
                  fontWeight: 600
                }}>
                  ✓ Uploaded - Click to change
                </div>
              )}
            </div>

            {step1Complete && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#1a1a1a',
                borderRadius: '12px',
                border: '1px solid #D4A853'
              }}>
                <p style={{ 
                  color: '#D4A853', 
                  fontSize: '0.9rem', 
                  margin: 0,
                  fontWeight: 600
                }}>
                  ✓ Step 1 Complete
                </p>
                <p style={{ 
                  color: '#888', 
                  fontSize: '0.85rem', 
                  margin: '4px 0 0 0'
                }}>
                  Now choose your story →
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Choose Story (60%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '60px 40px 120px 40px',
          opacity: step1Complete ? 1 : 0.3,
          pointerEvents: step1Complete ? 'auto' : 'none',
          transition: 'opacity 0.3s',
          overflowY: 'auto'
        }}
        className="md:w-3/5"
        >
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <p style={{ 
              color: step1Complete ? '#666' : '#444', 
              fontSize: '0.85rem', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Step 2 of 2
            </p>
            
            <h2 style={{ 
              margin: '0 0 32px 0', 
              fontSize: '2rem', 
              fontWeight: '700',
              color: step1Complete ? '#fff' : '#444'
            }}>
              Choose Your Story
            </h2>

            {/* 2-Column Card Grid */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginBottom: '32px'
            }}
            className="grid-cols-1 md:grid-cols-2"
            >
              {TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  onClick={() => step1Complete && handleTemplateClick(template)}
                  style={{
                    background: selectedTemplate === template.id ? 'linear-gradient(135deg, #D4A853 0%, #B8923F 100%)' : '#111',
                    border: selectedTemplate === template.id ? '2px solid #D4A853' : '1px solid #222',
                    borderRadius: '16px',
                    padding: '24px',
                    cursor: step1Complete ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    minHeight: '180px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseEnter={(e) => {
                    if (step1Complete && selectedTemplate !== template.id) {
                      e.currentTarget.style.borderColor = '#444';
                      e.currentTarget.style.background = '#1a1a1a';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (step1Complete && selectedTemplate !== template.id) {
                      e.currentTarget.style.borderColor = '#222';
                      e.currentTarget.style.background = '#111';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <div style={{ 
                    fontSize: '3rem',
                    marginBottom: '12px',
                    filter: selectedTemplate === template.id ? 'none' : 'grayscale(0.5)'
                  }}>
                    {template.emoji}
                  </div>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '1.3rem', 
                    fontWeight: '700',
                    color: selectedTemplate === template.id ? '#000' : '#fff'
                  }}>
                    {template.title}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.9rem',
                    color: selectedTemplate === template.id ? 'rgba(0,0,0,0.8)' : '#888',
                    lineHeight: 1.5,
                    flex: 1
                  }}>
                    {template.outcome}
                  </p>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#1a0a0a',
                border: '1px solid #ff4444',
                borderRadius: '12px',
                padding: '16px',
                color: '#ff4444',
                fontSize: '0.9rem',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STICKY CTA BUTTON (Bottom Right) */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        left: 0,
        padding: '20px',
        background: 'linear-gradient(to top, #0a0a0a 80%, transparent)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center'
      }}
      className="md:left-[40%] md:justify-end md:pr-10"
      >
        <button
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          style={{
            background: canGenerate && !loading ? '#D4A853' : '#333',
            color: canGenerate && !loading ? '#000' : '#666',
            border: 'none',
            borderRadius: '16px',
            padding: '20px 32px',
            fontSize: '1.1rem',
            fontWeight: '700',
            cursor: canGenerate && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            opacity: canGenerate && !loading ? 1 : 0.5,
            boxShadow: canGenerate && !loading ? '0 8px 30px rgba(212,168,83,0.4)' : 'none',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(212,168,83,0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,168,83,0.4)';
            }
          }}
        >
          {loading ? (
            '✨ Creating Your Movie...'
          ) : (
            <>
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
                🎬 Generate Your AI Movie ($2.9)
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                Ready in 60 seconds
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
