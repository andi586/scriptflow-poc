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
  },
  {
    id: "parallel_universe_2",
    title: "What Could Have Been",
    emoji: "🌠",
    outcome: "Watch yourself in the life you didn't choose",
    story: "You see another version of yourself living a different life. You watch them with longing. The final moment: you realize what could have been."
  }
];

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>(
    Array(6).fill(null).map(() => ({ file: null, url: null }))
  );
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [story, setStory] = useState(TEMPLATES[0].story);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id); // Auto-select first
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ctaJustActivated, setCtaJustActivated] = useState(false);
  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const extraPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
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
    
    // Trigger bounce animation
    setCtaJustActivated(true);
    setTimeout(() => setCtaJustActivated(false), 600);
  };

  const handleExtraPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setExtraPhotos(prev => {
      const updated = [...prev];
      updated[index] = { file, url: URL.createObjectURL(file) };
      return updated;
    });
  };

  const handleTemplateClick = (template: typeof TEMPLATES[0]) => {
    setStory(template.story);
    setSelectedTemplate(template.id);
  };

  const handleGenerate = async () => {
    if (loading || !mainPhoto.file) return;
    
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

  const canGenerate = !!mainPhoto.file;
  const uploadedCount = extraPhotos.filter(p => p.file).length;

  return (
    <div style={{ 
      background: '#0a0a0a', 
      height: '100vh', 
      color: 'white', 
      fontFamily: 'system-ui',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Desktop: 2-Column Layout */}
      <div style={{ 
        display: 'flex',
        height: '100%',
        flexDirection: 'row'
      }}
      className="flex-col md:flex-row"
      >
        
        {/* LEFT PANEL: Upload Photo (35%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid #1a1a1a'
        }}
        className="md:w-[35%]"
        >
          <div style={{ maxWidth: '380px', margin: '0 auto', width: '100%' }}>
            <h1 style={{ 
              color: '#D4A853', 
              fontSize: '1.8rem', 
              fontWeight: '700',
              marginBottom: '8px',
              letterSpacing: '0.05em'
            }}>
              ScriptFlow
            </h1>
            <p style={{ 
              color: '#888', 
              fontSize: '1rem', 
              marginBottom: '32px'
            }}>
              Turn yourself into a cinematic story
            </p>

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
                e.currentTarget.style.borderColor = '#D4A853';
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
                    Upload Your Photo
                  </p>
                </>
              )}
              {mainPhoto.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    mainPhotoRef.current?.click();
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.9)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    color: '#D4A853',
                    border: '1px solid #D4A853',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Choose Story (65%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '60px 40px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        className="md:w-[65%]"
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ 
              margin: '0 0 32px 0', 
              fontSize: '2rem', 
              fontWeight: '700',
              color: '#fff'
            }}>
              Choose Your Story
            </h2>

            {/* 2x3 Card Grid (No Scroll) */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              flex: 1,
              alignContent: 'start'
            }}
            className="grid-cols-1 md:grid-cols-2"
            >
              {TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  style={{
                    background: selectedTemplate === template.id ? 'linear-gradient(135deg, #D4A853 0%, #B8923F 100%)' : '#111',
                    border: selectedTemplate === template.id ? '2px solid #D4A853' : '1px solid #222',
                    borderRadius: '16px',
                    padding: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: selectedTemplate === template.id ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: selectedTemplate === template.id ? '0 0 20px rgba(212,168,83,0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTemplate !== template.id) {
                      e.currentTarget.style.borderColor = '#444';
                      e.currentTarget.style.background = '#1a1a1a';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTemplate !== template.id) {
                      e.currentTarget.style.borderColor = '#222';
                      e.currentTarget.style.background = '#111';
                    }
                  }}
                >
                  <div style={{ 
                    fontSize: '2.5rem',
                    marginBottom: '8px'
                  }}>
                    {template.emoji}
                  </div>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '1.1rem', 
                    fontWeight: '700',
                    color: selectedTemplate === template.id ? '#000' : '#fff'
                  }}>
                    {template.title}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '0.85rem',
                    color: selectedTemplate === template.id ? 'rgba(0,0,0,0.7)' : '#888',
                    lineHeight: 1.4
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
                padding: '12px',
                color: '#ff4444',
                fontSize: '0.85rem',
                marginTop: '16px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            {/* Add More Characters Link + CTA */}
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => setShowExtraModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  padding: 0,
                  textDecoration: 'underline'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#D4A853';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#666';
                }}
              >
                + Add more characters (optional)
              </button>

              <button
                onClick={handleGenerate}
                disabled={loading || !canGenerate}
                style={{
                  width: '100%',
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
                  animation: ctaJustActivated ? 'bounce 0.6s ease' : 'none'
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
                      🎬 Generate Your Movie
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                      $2.9 · Ready in 60s
                    </div>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Photos Modal */}
      {showExtraModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowExtraModal(false)}
        >
          <div 
            style={{
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#D4A853', fontSize: '1.5rem', margin: 0 }}>Add Characters</h2>
              <button
                onClick={() => setShowExtraModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: 0
                }}
              >✕</button>
            </div>
            
            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '24px' }}>
              Add up to 6 photos for richer stories
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px',
              marginBottom: '24px'
            }}>
              {extraPhotos.map((photo, index) => (
                <div key={index}>
                  <input
                    ref={el => { extraPhotoRefs.current[index] = el }}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={(e) => handleExtraPhotoChange(index, e)}
                    style={{ display: 'none' }}
                  />
                  
                  <div
                    onClick={() => extraPhotoRefs.current[index]?.click()}
                    style={{
                      cursor: 'pointer',
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '12px',
                      background: photo.url ? `url(${photo.url})` : '#1a1a1a',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: photo.url ? '2px solid #555' : '2px dashed #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4A853';
                    }}
                    onMouseLeave={(e) => {
                      if (!photo.url) {
                        e.currentTarget.style.borderColor = '#333';
                      } else {
                        e.currentTarget.style.borderColor = '#555';
                      }
                    }}
                  >
                    {!photo.url && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', color: '#555' }}>+</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {uploadedCount > 0 && (
              <p style={{ color: '#4ade80', fontSize: '0.85rem', textAlign: 'center', marginBottom: '16px' }}>
                ✓ {uploadedCount} character{uploadedCount > 1 ? 's' : ''} added
              </p>
            )}

            <button
              onClick={() => setShowExtraModal(false)}
              style={{
                width: '100%',
                background: '#D4A853',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-10px); }
          50% { transform: translateY(0); }
          75% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
