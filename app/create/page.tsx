"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "prank", label: "整蛊朋友", story: "My friends pranked me and it went completely viral..." },
  { id: "pet", label: "宠物故事", story: "My dog left me a final message before passing away..." },
  { id: "future", label: "穿越未来", story: "I met my future self and got a warning..." },
];

interface CharacterPhoto {
  file: File | null;
  url: string | null;
}

export default function CreatePage() {
  const [showCreator, setShowCreator] = useState(false);
  const [story, setStory] = useState("");
  const [mainPhoto, setMainPhoto] = useState<CharacterPhoto>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const extraPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  const handleCategoryClick = (category: typeof CATEGORIES[0]) => {
    setStory(category.story);
    setShowCreator(true);
  };

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

  const addExtraPhotoSlot = () => {
    if (extraPhotos.length < 6) {
      setExtraPhotos(prev => [...prev, { file: null, url: null }]);
    }
  };

  const removeExtraPhoto = (index: number) => {
    setExtraPhotos(prev => prev.filter((_, i) => i !== index));
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

  if (!showCreator) {
    // Landing view with category buttons
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
          <h1 style={{ color: '#D4A853', fontSize: '2.5rem', marginBottom: '16px', fontWeight: 700 }}>
            ScriptFlow
          </h1>
          <p style={{ color: '#888', fontSize: '1rem', marginBottom: '48px' }}>
            你的故事，你的电影 / Your Story, Your Movie
          </p>

          {/* Primary CTA */}
          <button
            onClick={() => setShowCreator(true)}
            style={{
              width: '100%',
              background: '#D4A853',
              color: '#000',
              border: 'none',
              borderRadius: '16px',
              padding: '24px',
              fontSize: '1.5rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '24px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🎬 创建我的电影
          </button>

          {/* Category buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  background: '#1a1a1a',
                  color: '#D4A853',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontSize: '0.95rem',
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
            ⚡ 60秒生成 • 免费试用
          </p>
        </div>
      </div>
    );
  }

  // Creator view
  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '48px 20px 140px', 
      fontFamily: 'system-ui' 
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        {/* Back button */}
        <button
          onClick={() => setShowCreator(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '0.9rem',
            cursor: 'pointer',
            marginBottom: '24px',
            padding: '8px 0'
          }}
        >
          ← 返回
        </button>

        {/* Main Photo Upload */}
        <div style={{ marginBottom: '24px' }}>
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
              background: '#111',
              border: mainPhoto.url ? '3px solid #D4A853' : '3px dashed #D4A853',
              borderRadius: '20px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              transition: 'all 0.2s'
            }}
          >
            {mainPhoto.url ? (
              <>
                <img 
                  src={mainPhoto.url} 
                  style={{ 
                    width: '120px', 
                    height: '120px', 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '3px solid #D4A853'
                  }} 
                  alt="Your photo" 
                />
                <p style={{ color: '#4ade80', fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>
                  ✓ 照片已上传 - 点击更换
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '4rem' }}>📷</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#D4A853', fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>
                    上传您的照片
                  </p>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '4px' }}>
                    Upload Your Photo (Required)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Extra Characters */}
        {extraPhotos.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {extraPhotos.map((photo, index) => (
                <div key={index} style={{ position: 'relative' }}>
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
                      overflow: 'hidden'
                    }}
                  >
                    {photo.url ? (
                      <img src={photo.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Character ${index + 2}`} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>📷</span>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExtraPhoto(index);
                    }}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#333',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      color: '#aaa',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {extraPhotos.length < 6 && (
          <button
            onClick={addExtraPhotoSlot}
            style={{
              background: 'none',
              border: '2px dashed #333',
              borderRadius: '12px',
              padding: '12px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              width: '100%',
              marginBottom: '24px',
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
            + 添加角色
          </button>
        )}

        {/* Story Input */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
            故事 / Story (Optional)
          </label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="描述你的故事..."
            style={{ 
              width: '100%', 
              background: '#111', 
              border: '1px solid #333', 
              borderRadius: '12px', 
              color: 'white', 
              padding: '14px', 
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
            padding: '12px 16px',
            color: '#ff4444',
            fontSize: '0.85rem',
            marginBottom: '20px'
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
            padding: '18px',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: loading || !mainPhoto.file ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {loading ? '✨ 生成中...' : '🎬 生成电影'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '12px' }}>
          ⚡ 60秒生成 • 免费试用
        </p>
      </div>
    </div>
  );
}
