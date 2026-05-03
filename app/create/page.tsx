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
  const [showExtraPhotos, setShowExtraPhotos] = useState(false);
  const [story, setStory] = useState(TEMPLATES[0].story);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
  const uploadedCount = extraPhotos.filter(p => p.file).length;

  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '40px 20px', 
      fontFamily: 'system-ui',
      position: 'relative'
    }}>
      {/* My Videos Button */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px',
        zIndex: 10
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

      <div style={{ maxWidth: '700px', width: '100%' }}>
        
        {/* STEP 1: Upload Photo */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: step1Complete ? '#D4A853' : '#333',
              color: step1Complete ? '#000' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '1rem'
            }}>
              {step1Complete ? '✓' : '1'}
            </div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: step1Complete ? '#fff' : '#666'
            }}>
              Upload Your Photo
            </h2>
          </div>

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
              height: '200px',
              borderRadius: '16px',
              background: mainPhoto.url ? `url(${mainPhoto.url})` : '#111',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: mainPhoto.url ? '3px solid #D4A853' : '3px dashed #333',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              position: 'relative'
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
                <div style={{ fontSize: '4rem', marginBottom: '12px' }}>📷</div>
                <p style={{ color: '#D4A853', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  Click to upload your photo
                </p>
                <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '8px' }}>
                  JPG, PNG, or WEBP
                </p>
              </>
            )}
            {mainPhoto.url && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.8)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                color: '#4ade80'
              }}>
                ✓ Uploaded - Click to change
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: Choose Story */}
        <div style={{ 
          marginBottom: '48px',
          opacity: step1Complete ? 1 : 0.4,
          pointerEvents: step1Complete ? 'auto' : 'none',
          transition: 'opacity 0.3s'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: step2Complete ? '#D4A853' : '#333',
              color: step2Complete ? '#000' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '1rem'
            }}>
              {step2Complete ? '✓' : '2'}
            </div>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: step1Complete ? (step2Complete ? '#fff' : '#666') : '#444'
            }}>
              Choose Your Story
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => step1Complete && handleTemplateClick(template)}
                style={{
                  background: selectedTemplate === template.id ? 'linear-gradient(135deg, #D4A853 0%, #B8923F 100%)' : '#111',
                  border: selectedTemplate === template.id ? '2px solid #D4A853' : '1px solid #333',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: step1Complete ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (step1Complete && selectedTemplate !== template.id) {
                    e.currentTarget.style.borderColor = '#555';
                    e.currentTarget.style.background = '#1a1a1a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (step1Complete && selectedTemplate !== template.id) {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = '#111';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    fontSize: '2.5rem',
                    filter: selectedTemplate === template.id ? 'none' : 'grayscale(0.5)'
                  }}>
                    {template.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '1.2rem', 
                      fontWeight: '700',
                      color: selectedTemplate === template.id ? '#000' : '#fff'
                    }}>
                      {template.title}
                    </h3>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.95rem',
                      color: selectedTemplate === template.id ? 'rgba(0,0,0,0.8)' : '#aaa',
                      lineHeight: 1.4
                    }}>
                      {template.outcome}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optional: Add Characters (Collapsible) */}
        <div style={{ marginBottom: '32px' }}>
          <button
            onClick={() => setShowExtraPhotos(!showExtraPhotos)}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px dashed #333',
              borderRadius: '12px',
              padding: '16px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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
            <span>+ Add Characters (Optional) — More photos = richer story</span>
            <span>{showExtraPhotos ? '▼' : '▶'}</span>
          </button>

          {showExtraPhotos && (
            <div style={{ 
              marginTop: '16px',
              padding: '20px',
              background: '#111',
              borderRadius: '12px',
              border: '1px solid #222'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '12px',
                marginBottom: '16px'
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
                        if (!photo.url) {
                          e.currentTarget.style.borderColor = '#D4A853';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!photo.url) {
                          e.currentTarget.style.borderColor = '#333';
                        }
                      }}
                    >
                      {!photo.url && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', color: '#555' }}>+</div>
                          <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
                            {index + 1}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {uploadedCount > 0 && (
                <p style={{ color: '#4ade80', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                  ✓ {uploadedCount} character{uploadedCount > 1 ? 's' : ''} added
                </p>
              )}
            </div>
          )}
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
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* STEP 3: Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !canGenerate}
          style={{
            width: '100%',
            background: canGenerate && !loading ? '#D4A853' : '#333',
            color: canGenerate && !loading ? '#000' : '#666',
            border: 'none',
            borderRadius: '16px',
            padding: '20px',
            fontSize: '1.2rem',
            fontWeight: '700',
            cursor: canGenerate && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            opacity: canGenerate && !loading ? 1 : 0.5,
            boxShadow: canGenerate && !loading ? '0 4px 20px rgba(212,168,83,0.3)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 25px rgba(212,168,83,0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,168,83,0.3)';
            }
          }}
        >
          {loading ? '✨ Creating Your Movie...' : '🎬 Generate Your AI Movie ($2.9) — Ready in 60 seconds'}
        </button>

        {!canGenerate && (
          <p style={{ 
            textAlign: 'center', 
            color: '#666', 
            fontSize: '0.85rem', 
            marginTop: '12px' 
          }}>
            {!step1Complete ? '↑ Upload your photo to continue' : '↑ Choose your story to continue'}
          </p>
        )}
      </div>
    </div>
  );
}
