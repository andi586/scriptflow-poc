"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const HOOKS = [
  { label: "出轨", story: "I caught my partner cheating on me at 3AM..." },
  { label: "复仇", story: "My boss humiliated me in front of everyone, I got revenge..." },
  { label: "背叛", story: "My best friend betrayed me after 10 years..." },
  { label: "穿越", story: "I met my future self and got a warning..." },
  { label: "宠物", story: "My dog left me a final message before passing away..." },
  { label: "重逢", story: "I ran into my ex after 5 years and everything changed..." },
  { label: "整蛊", story: "My friends pranked me and it went completely viral..." },
  { label: "秘密", story: "Someone discovered my biggest secret..." },
];

const CHARACTER_LABELS = [
  "主角 / You",
  "朋友 2 / Friend 2",
  "朋友 3 / Friend 3",
  "朋友 4 / Friend 4",
  "朋友 5 / Friend 5",
  "朋友 6 / Friend 6",
  "宠物 / Pet",
];

interface CharacterPhoto {
  file: File | null;
  url: string | null;
}

export default function CreatePage() {
  const [story, setStory] = useState("I caught my partner cheating on me at 3AM...");
  const [characters, setCharacters] = useState<CharacterPhoto[]>([
    { file: null, url: null }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCharacters(prev => {
      const updated = [...prev];
      updated[index] = { file, url: URL.createObjectURL(file) };
      return updated;
    });
    setError(null);
  };

  const addCharacterSlot = () => {
    if (characters.length < 7) {
      setCharacters(prev => [...prev, { file: null, url: null }]);
    }
  };

  const removeCharacterSlot = (index: number) => {
    if (index === 0) return; // Can't remove main character
    setCharacters(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!characters[0].file) {
      setError("Please upload your photo first!");
      return;
    }
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const form = new FormData();
      form.append("photo", characters[0].file!);
      form.append("story", story);
      form.append("tier", "30s");
      
      // Add additional character photos
      let castIndex = 0;
      for (let i = 1; i < characters.length; i++) {
        if (characters[i].file) {
          form.append(`cast_${castIndex}`, characters[i].file!);
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
      padding: '48px 20px 140px', 
      fontFamily: 'system-ui' 
    }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: '#D4A853', fontSize: '2rem', marginBottom: '8px', fontWeight: 700 }}>
            🎬 Create Your Viral Movie
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Your face. Your story. Ready in 60 seconds.
          </p>
        </div>

        {/* Story Input */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ color: '#D4A853', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
            📝 Your Story
          </label>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="Write your story here..."
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
              boxSizing: 'border-box',
              marginBottom: '12px'
            }}
          />
          
          {/* Keyword Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {HOOKS.map((hook, i) => (
              <button
                key={i}
                onClick={() => setStory(hook.story)}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  color: '#D4A853',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 500
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
                {hook.label}
              </button>
            ))}
          </div>
        </div>

        {/* Character Photos - Accordion Style */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ color: '#D4A853', fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '12px' }}>
            📷 Characters
          </label>

          {/* Main Character (Always Visible) */}
          <div style={{ marginBottom: '16px' }}>
            <input
              ref={el => { fileInputRefs.current[0] = el }}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => handlePhotoChange(0, e)}
              style={{ display: 'none' }}
            />
            
            <div
              onClick={() => fileInputRefs.current[0]?.click()}
              style={{
                cursor: 'pointer',
                background: '#111',
                border: characters[0].url ? '2px solid #D4A853' : '2px dashed #D4A853',
                borderRadius: '16px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: characters[0].url ? 'transparent' : '#1a1a1a',
                border: '2px solid #D4A853',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {characters[0].url ? (
                  <img src={characters[0].url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Main character" />
                ) : (
                  <span style={{ fontSize: '2rem' }}>📷</span>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ 
                    background: '#D4A853', 
                    color: '#000', 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '0.75rem', 
                    fontWeight: 700 
                  }}>1</span>
                  <span style={{ color: '#D4A853', fontWeight: 600, fontSize: '0.95rem' }}>
                    {CHARACTER_LABELS[0]}
                  </span>
                  <span style={{ color: '#ff4444', fontSize: '0.75rem', fontWeight: 600 }}>REQUIRED</span>
                </div>
                <p style={{ color: characters[0].url ? '#4ade80' : '#888', fontSize: '0.85rem', margin: 0 }}>
                  {characters[0].url ? '✓ Photo uploaded - Click to change' : 'Click to upload your photo'}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Character Slots */}
          {characters.slice(1).map((char, index) => {
            const actualIndex = index + 1;
            return (
              <div key={actualIndex} style={{ marginBottom: '12px' }}>
                <input
                  ref={el => { fileInputRefs.current[actualIndex] = el }}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => handlePhotoChange(actualIndex, e)}
                  style={{ display: 'none' }}
                />
                
                <div style={{
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div
                    onClick={() => fileInputRefs.current[actualIndex]?.click()}
                    style={{
                      cursor: 'pointer',
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: char.url ? 'transparent' : '#1a1a1a',
                      border: char.url ? '2px solid #555' : '2px dashed #333',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    {char.url ? (
                      <img src={char.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Character ${actualIndex + 1}`} />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>📷</span>
                    )}
                  </div>
                  
                  <div style={{ flex: 1 }} onClick={() => fileInputRefs.current[actualIndex]?.click()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ 
                        background: '#333', 
                        color: '#888', 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '0.7rem', 
                        fontWeight: 600 
                      }}>{actualIndex + 1}</span>
                      <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                        {CHARACTER_LABELS[actualIndex]}
                      </span>
                    </div>
                    <p style={{ color: char.url ? '#4ade80' : '#666', fontSize: '0.75rem', margin: 0, cursor: 'pointer' }}>
                      {char.url ? '✓ Uploaded' : 'Click to add photo'}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => removeCharacterSlot(actualIndex)}
                    style={{
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      color: '#888',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >✕</button>
                </div>
              </div>
            );
          })}

          {/* Add Character Button */}
          {characters.length < 7 && (
            <button
              onClick={addCharacterSlot}
              style={{
                width: '100%',
                background: '#1a1a1a',
                border: '2px dashed #333',
                borderRadius: '12px',
                padding: '16px',
                color: '#888',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
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
              <span style={{ fontSize: '1.2rem' }}>+</span>
              Add Character {characters.length + 1}
            </button>
          )}
        </div>

        {/* Error Message */}
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
          disabled={loading || !characters[0].file}
          style={{
            width: '100%',
            background: loading || !characters[0].file ? '#333' : '#D4A853',
            color: loading || !characters[0].file ? '#666' : '#000',
            border: 'none',
            borderRadius: '16px',
            padding: '18px',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: loading || !characters[0].file ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: '12px'
          }}
        >
          {loading ? '✨ Creating your movie...' : '🎬 Create My Movie'}
        </button>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem' }}>
          ⚡ Ready in 60 seconds • Free to try
        </p>
      </div>
    </div>
  );
}
