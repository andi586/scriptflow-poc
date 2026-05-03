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
    emotion: "curious + melancholy",
    description: "What if you lived a completely different life?",
    ending_line: "I could have lived like this.",
    story: "You see another version of yourself living a different life. You watch them with longing. The final moment: you realize what could have been."
  },
  {
    id: "she_didnt_choose_you", 
    title: "She Didn't Choose You",
    emoji: "💔",
    emotion: "heartbreak + regret",
    description: "You were ready. She wasn't.",
    ending_line: "She smiled. Just not at you.",
    story: "You prepare to confess your feelings. She walks toward someone else. Her smile breaks your heart."
  },
  {
    id: "future_you",
    title: "Your Future Self Visits",
    emoji: "✨",
    emotion: "hope + determination", 
    description: "A better version of you has a message.",
    ending_line: "You will become me.",
    story: "A stronger, wiser version of you appears. They look at you with knowing eyes. They say one thing before disappearing."
  },
  {
    id: "lost_someone",
    title: "You Lost Them",
    emoji: "🕯️",
    emotion: "grief + memory",
    description: "Some people leave footprints that never fade.",
    ending_line: "Just you. And the silence they left behind.",
    story: "Flashes of memory with someone important. They slowly fade away. You are left alone with the echo of what was."
  },
  {
    id: "last_person",
    title: "The Last Person on Earth",
    emoji: "🌍",
    emotion: "lonely + philosophical",
    description: "What if the world went quiet?",
    ending_line: "No one answered.",
    story: "You walk through an empty world. You search for someone, anyone. Silence is the only response."
  }
];

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>(
    Array(6).fill(null).map(() => ({ file: null, url: null }))
  );
  const [showModal, setShowModal] = useState(false);
  const [story, setStory] = useState(TEMPLATES[0].story);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
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
        // Real user session
        setUserId(session.user.id);
        console.log('[create/page] userId from session:', session.user.id);
      } else {
        // Anonymous user - generate or retrieve guest ID
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
          guestId = crypto.randomUUID();
          localStorage.setItem('guestId', guestId);
          console.log('[create/page] generated new guestId:', guestId);
        } else {
          console.log('[create/page] using existing guestId:', guestId);
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
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Upload main photo
      console.log('[create/page] Uploading main photo...');
      const mainFormData = new FormData();
      mainFormData.append('file', mainPhoto.file);
      const mainUploadRes = await fetch('/api/upload-photo', { 
        method: 'POST', 
        body: mainFormData 
      });
      const mainUploadData = await mainUploadRes.json();
      const mainPhotoUrl = mainUploadData.url;
      
      if (!mainPhotoUrl) throw new Error('Failed to upload main photo');
      console.log('[create/page] Main photo uploaded:', mainPhotoUrl);
      
      // Step 2: Upload extra photos
      console.log('[create/page] Uploading extra photos...');
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
      console.log('[create/page] Extra photos uploaded:', additionalImages.length, additionalImages);
      
      // Step 3: Generate movie
      const body = {
        story,
        tier: "30s",
        userId: userId || crypto.randomUUID(),
        main_photo_url: mainPhotoUrl,
        additional_images: additionalImages
      };
      
      console.log('[create/page] Sending to /api/movie/generate:', JSON.stringify(body, null, 2));
      
      const res = await fetch("/api/movie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to create movie");
      if (!data.movieId) throw new Error("No movie ID returned");
      
      console.log('[create/page] Movie created:', data.movieId);
      router.push(`/movie/${data.movieId}`);
    } catch (e: any) {
      console.error('[create/page] Error:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadedCount = extraPhotos.filter(p => p.file).length;

  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px', 
      fontFamily: 'system-ui',
      position: 'relative'
    }}>
      {/* My Videos Button - Top Right */}
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

      <div style={{ maxWidth: '600px', width: '100%', padding: '0 16px' }}>
        
        {/* Main Photo - Big Circle */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '12px' }}>
            ① Upload your photo
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
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: mainPhoto.url ? 'transparent' : '#111',
              border: mainPhoto.url ? '4px solid #D4A853' : '4px dashed #D4A853',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              overflow: 'hidden',
              transition: 'all 0.2s'
            }}
            className="md:w-32 md:h-32"
          >
            {mainPhoto.url ? (
              <img 
                src={mainPhoto.url} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt="Main character" 
              />
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '4px' }}>📷</div>
                <p style={{ color: '#D4A853', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                  You
                </p>
              </>
            )}
          </div>
          
          {mainPhoto.url && (
            <p style={{ color: '#4ade80', fontSize: '0.75rem', marginTop: '8px' }}>
              ✓ Uploaded - Click to change
            </p>
          )}
        </div>

        {/* Add More Button */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#1a1a1a',
              border: '2px dashed #333',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            +
          </button>
          {uploadedCount > 0 && (
            <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '6px' }}>
              {uploadedCount} more added
            </p>
          )}
        </div>

        {/* Template Selection */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '12px' }}>
            ② Choose your emotional story
          </p>
          
          {/* Template Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                style={{
                  background: selectedTemplate === template.id ? 'linear-gradient(135deg, #D4A853 0%, #B8923F 100%)' : '#111',
                  border: selectedTemplate === template.id ? '2px solid #D4A853' : '1px solid #333',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (selectedTemplate !== template.id) {
                    e.currentTarget.style.borderColor = '#555';
                    e.currentTarget.style.background = '#1a1a1a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTemplate !== template.id) {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.background = '#111';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ 
                    fontSize: '2.5rem', 
                    lineHeight: 1,
                    filter: selectedTemplate === template.id ? 'none' : 'grayscale(0.5)'
                  }}>
                    {template.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: '1.1rem', 
                      fontWeight: 700,
                      color: selectedTemplate === template.id ? '#000' : '#fff'
                    }}>
                      {template.title}
                    </h3>
                    <div style={{ 
                      display: 'inline-block',
                      background: selectedTemplate === template.id ? 'rgba(0,0,0,0.2)' : 'rgba(212,168,83,0.15)',
                      color: selectedTemplate === template.id ? '#000' : '#D4A853',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      marginBottom: '8px'
                    }}>
                      {template.emotion}
                    </div>
                    <p style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '0.85rem',
                      color: selectedTemplate === template.id ? '#000' : '#aaa',
                      lineHeight: 1.4
                    }}>
                      {template.description}
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      color: selectedTemplate === template.id ? 'rgba(0,0,0,0.7)' : '#666',
                      borderLeft: selectedTemplate === template.id ? '2px solid rgba(0,0,0,0.3)' : '2px solid #333',
                      paddingLeft: '8px'
                    }}>
                      "{template.ending_line}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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

        {/* Generate Button */}
        <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '12px' }}>
          ③ Generate your movie
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading || !mainPhoto.file}
          style={{
            width: '100%',
            background: loading || !mainPhoto.file ? '#333' : '#D4A853',
            color: loading || !mainPhoto.file ? '#666' : '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '18px',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: loading || !mainPhoto.file ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: loading || !mainPhoto.file ? 0.5 : 1
          }}
        >
          {loading ? '✨ Creating...' : '🎬 See Your Story'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.75rem', marginTop: '12px' }}>
          ⚡ Ready in 60 seconds
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 style={{ color: '#D4A853', fontSize: '1.2rem', margin: 0 }}>Add More</h2>
              <button
                onClick={() => setShowModal(false)}
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
            
            {/* Hint Text */}
            <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '20px', marginTop: '4px' }}>
              Add up to 6 photos of characters or scenes
            </p>

            {/* Photo Upload Circles */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px', 
              marginBottom: '20px' 
            }}>
              {extraPhotos.map((photo, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
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
                      borderRadius: '50%',
                      background: photo.url ? 'transparent' : '#1a1a1a',
                      border: photo.url ? '2px solid #555' : '2px dashed #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      position: 'relative'
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
                    {photo.url ? (
                      <img 
                        src={photo.url} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        alt={`Character ${index + 1}`} 
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '1.8rem', color: '#555' }}>+</span>
                        <span style={{ fontSize: '0.7rem', color: '#666' }}>{index + 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Done Button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                background: '#D4A853',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
