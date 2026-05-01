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

const STORY_KEYWORDS = [
  { label: "Affair", story: "I caught my partner cheating on me at 3AM and everything changed..." },
  { label: "Revenge", story: "My boss humiliated me in front of everyone, I got revenge..." },
  { label: "Betrayal", story: "My best friend betrayed me after 10 years..." },
  { label: "Time Travel", story: "I met my future self and got a warning..." },
  { label: "Pet", story: "My beloved pet left me a final message before I lost them..." },
  { label: "Reunion", story: "I ran into my ex after 5 years and everything changed..." },
  { label: "Prank", story: "My friends pranked me and it went completely viral..." },
  { label: "Secret", story: "Someone discovered my biggest secret..." },
];

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>(
    Array(6).fill(null).map(() => ({ file: null, url: null }))
  );
  const [showModal, setShowModal] = useState(false);
  const [story, setStory] = useState("I caught my partner cheating on me at 3AM and everything changed...");
  const [selectedKeyword, setSelectedKeyword] = useState("Affair");
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
        // Create guest session or use fallback
        setUserId("2877b339-1f39-4871-92f4-e638d63b5d09");
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

  const handleKeywordClick = (keyword: typeof STORY_KEYWORDS[0]) => {
    setStory(keyword.story);
    setSelectedKeyword(keyword.label);
  };

  const handleGenerate = async () => {
    if (!mainPhoto.file) {
      setError("Please upload your photo");
      return;
    }
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Upload extra character photos to Supabase first
      const additionalImages: string[] = [];
      for (const photo of extraPhotos) {
        if (photo.file) {
          const formData = new FormData();
          formData.append('file', photo.file);
          
          // Upload to Supabase storage
          const uploadRes = await fetch('/api/upload-photo', {
            method: 'POST',
            body: formData
          });
          
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
              additionalImages.push(uploadData.url);
            }
          }
        }
      }
      
      const body = {
        story: story,
        tier: "30s",
        userId: userId || "2877b339-1f39-4871-92f4-e638d63b5d09",
        ...(additionalImages.length > 0 && { additional_images: additionalImages })
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

        {/* Story Input */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '12px' }}>
            ② Choose a story or write your own
          </p>
          
          {/* Unified Story Box */}
          <div style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '16px',
            padding: '12px',
          }}>
            {/* Keyword Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' }}>
              {STORY_KEYWORDS.map((keyword) => (
                <button
                  key={keyword.label}
                  type="button"
                  onClick={() => { setStory(keyword.story); setSelectedKeyword(keyword.label); }}
                  style={{
                    background: selectedKeyword === keyword.label ? '#D4A853' : '#1a1a1a',
                    color: selectedKeyword === keyword.label ? '#000' : '#fff',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '8px 4px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {keyword.label}
                </button>
              ))}
            </div>

            {/* Hint Text */}
            <p style={{ color: '#666', fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '8px', marginTop: 0 }}>
              Or describe your own story here...
            </p>

            {/* Textarea */}
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '0.875rem',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'system-ui',
                cursor: 'text',
              }}
            />
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
          {loading ? '✨ Creating...' : '🎬 Create My Movie'}
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
