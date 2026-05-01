"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface CharacterPhoto {
  file: File | null;
  url: string | null;
}

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<CharacterPhoto>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>([
    { file: null, url: null },
    { file: null, url: null },
    { file: null, url: null },
    { file: null, url: null },
  ]);
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

  const handleGenerate = async () => {
    if (!mainPhoto.file) {
      setError("请上传您的照片 / Please upload your photo");
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
      fontFamily: 'system-ui' 
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        
        {/* Main Photo - Big Circle */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
                  你 / You
                </p>
              </>
            )}
          </div>
          
          {mainPhoto.url && (
            <p style={{ color: '#4ade80', fontSize: '0.85rem', marginTop: '12px' }}>
              ✓ 已上传 - 点击更换
            </p>
          )}
        </div>

        {/* Extra Photos - Small Circles Row */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          justifyContent: 'center', 
          marginBottom: '40px',
          flexWrap: 'wrap'
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
                  width: '80px',
                  height: '80px',
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
                    alt={`Character ${index + 2}`} 
                  />
                ) : (
                  <span style={{ fontSize: '2rem', color: '#555' }}>+</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Story Input */}
        <div style={{ marginBottom: '32px' }}>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="你的故事..."
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
          {loading ? '✨ 生成中...' : '🎬 生成我的电影'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '16px' }}>
          ⚡ 60秒生成 • 免费试用
        </p>
      </div>
    </div>
  );
}
