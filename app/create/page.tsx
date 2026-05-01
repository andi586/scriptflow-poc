"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "prank", label: "整蛊朋友", story: "My friends pranked me and it went completely viral..." },
  { id: "pet", label: "宠物故事", story: "My dog left me a final message before passing away..." },
  { id: "love", label: "感情剧情", story: "I caught my partner cheating on me at 3AM..." },
];

export default function CreatePage() {
  const [showUpload, setShowUpload] = useState(false);
  const [story, setStory] = useState("");
  const [photo, setPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    setStory(category.story);
    setShowUpload(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto({ file, url: URL.createObjectURL(file) });
    setError(null);
  };

  const handleGenerate = async () => {
    if (!photo.file) {
      setError("Please upload your photo first!");
      return;
    }
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const form = new FormData();
      form.append("photo", photo.file);
      form.append("story", story);
      form.append("tier", "30s");
      
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

  if (!showUpload) {
    // Landing view
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
        fontFamily: 'system-ui' 
      }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <h1 style={{ color: '#D4A853', fontSize: '2.5rem', marginBottom: '48px', fontWeight: 700 }}>
            ScriptFlow
          </h1>

          {/* Big Primary Button */}
          <button
            onClick={() => setShowUpload(true)}
            style={{
              width: '100%',
              background: '#D4A853',
              color: '#000',
              border: 'none',
              borderRadius: '16px',
              padding: '28px',
              fontSize: '1.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '20px',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🎬 Be the Star
          </button>

          {/* Small Category Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  flex: 1,
                  background: '#1a1a1a',
                  color: '#D4A853',
                  border: '1px solid #333',
                  borderRadius: '10px',
                  padding: '12px 8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
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
                {cat.label}
              </button>
            ))}
          </div>

          <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '48px' }}>
            ⚡ Ready in 60 seconds
          </p>
        </div>
      </div>
    );
  }

  // Upload flow
  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '48px 20px', 
      fontFamily: 'system-ui' 
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {/* Back button */}
        <button
          onClick={() => setShowUpload(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '0.9rem',
            cursor: 'pointer',
            marginBottom: '32px',
            padding: 0
          }}
        >
          ← Back
        </button>

        {/* Photo Upload */}
        <div style={{ marginBottom: '32px' }}>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          
          <div
            onClick={() => photoRef.current?.click()}
            style={{
              cursor: 'pointer',
              background: '#111',
              border: photo.url ? '3px solid #D4A853' : '3px dashed #D4A853',
              borderRadius: '20px',
              padding: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px',
              transition: 'all 0.2s'
            }}
          >
            {photo.url ? (
              <>
                <img 
                  src={photo.url} 
                  style={{ 
                    width: '140px', 
                    height: '140px', 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '4px solid #D4A853'
                  }} 
                  alt="Your photo" 
                />
                <p style={{ color: '#4ade80', fontSize: '1rem', margin: 0, fontWeight: 600 }}>
                  ✓ Photo uploaded - Click to change
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '5rem' }}>📷</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#D4A853', fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
                    Upload Your Photo
                  </p>
                  <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '8px' }}>
                    Required
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Story Input */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
            Your Story (Optional)
          </label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="Describe your story..."
            style={{ 
              width: '100%', 
              background: '#111', 
              border: '1px solid #333', 
              borderRadius: '12px', 
              color: 'white', 
              padding: '16px', 
              fontSize: '0.95rem', 
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
          disabled={loading || !photo.file}
          style={{
            width: '100%',
            background: loading || !photo.file ? '#333' : '#D4A853',
            color: loading || !photo.file ? '#666' : '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '20px',
            fontSize: '1.2rem',
            fontWeight: 700,
            cursor: loading || !photo.file ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {loading ? '✨ Creating...' : '🎬 Create My Movie'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '16px' }}>
          ⚡ Ready in 60 seconds
        </p>
      </div>
    </div>
  );
}
