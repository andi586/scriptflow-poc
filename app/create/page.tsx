"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface CharacterPhoto {
  file: File | null;
  url: string | null;
}

const STORY_KEYWORDS = [
  { label: "Affair", story: "I caught my partner cheating on me at 3AM and everything changed..." },
  { label: "Revenge", story: "My boss humiliated me in front of everyone, I got revenge..." },
  { label: "Betrayal", story: "My best friend betrayed me after 10 years..." },
  { label: "Time Travel", story: "I met my future self and got a warning..." },
  { label: "Pet", story: "My dog left me a final message before passing away..." },
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const extraPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

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
      const form = new FormData();
      form.append("photo", mainPhoto.file);
      form.append("story", story);
      form.append("tier", "30s");
      
      // Add extra character photos
      let castIndex = 0;
      for (const photo of extraPhotos) {
        if (photo.file) {
          form.append(`cast_${castIndex}`, photo.file);
          castIndex++;
        }
      }
      
      const res = await fetch("/api/create-movie", {
        method: "POST",
        body: form,
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
      padding: '40px 20px', 
      fontFamily: 'system-ui',
      position: 'relative'
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        
        {/* Main Photo - Big Circle */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
              width: '180px',
              height: '180px',
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
          >
            {mainPhoto.url ? (
              <img 
                src={mainPhoto.url} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt="Main character" 
              />
            ) : (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '8px' }}>📷</div>
                <p style={{ color: '#D4A853', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  You
                </p>
              </>
            )}
          </div>
          
          {mainPhoto.url && (
            <p style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '12px' }}>
              ✓ Uploaded - Click to change
            </p>
          )}
        </div>

        {/* Add More Button */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#1a1a1a',
              border: '2px dashed #333',
              borderRadius: '50%',
              width: '60px',
              height: '60px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '2rem',
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
            <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '8px' }}>
              {uploadedCount} more added
            </p>
          )}
        </div>

        {/* Keyword Chips */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {STORY_KEYWORDS.map(keyword => (
              <button
                key={keyword.label}
                onClick={() => handleKeywordClick(keyword)}
                style={{
                  background: '#1a1a1a',
                  color: '#D4A853',
                  border: '1px solid #333',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#D4A853';
                  e.currentTarget.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1a1a1a';
                  e.currentTarget.style.color = '#D4A853';
                }}
              >
                {keyword.label}
              </button>
            ))}
          </div>
        </div>

        {/* Story Input */}
        <div style={{ marginBottom: '32px' }}>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="Your story..."
            style={{ 
              width: '100%', 
              background: '#111', 
              border: '1px solid #333', 
              borderRadius: '16px', 
              color: 'white', 
              padding: '18px', 
              fontSize: '1rem', 
              resize: 'none', 
              outline: 'none', 
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#1a0a0a',
            border: '1px solid #ff4444',
            borderRadius: '12px',
            padding: '14px',
            color: '#ff4444',
            fontSize: '0.9rem',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !mainPhoto.file}
          style={{
            width: '100%',
            background: loading || !mainPhoto.file ? '#333' : '#D4A853',
            color: loading || !mainPhoto.file ? '#666' : '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '22px',
            fontSize: '1.3rem',
            fontWeight: 700,
            cursor: loading || !mainPhoto.file ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {loading ? '✨ Creating...' : '🎬 Create My Movie'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '16px' }}>
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
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#D4A853', fontSize: '1.3rem', margin: 0 }}>Add More</h2>
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

            {/* Photo Upload Circles */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '16px', 
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
                      borderRadius: '50%',
                      background: photo.url ? 'transparent' : '#1a1a1a',
                      border: photo.url ? '2px solid #555' : '2px dashed #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
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
                    {photo.url ? (
                      <img 
                        src={photo.url} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        alt={`Character ${index + 1}`} 
                      />
                    ) : (
                      <span style={{ fontSize: '2rem', color: '#555' }}>+</span>
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
                padding: '16px',
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
