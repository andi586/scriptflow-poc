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
    title: "You met your future self… and he warned you",
    emoji: "🌌",
    outcome: "A glimpse of what could have been",
    story: "You see another version of yourself living a different life. You watch them with longing. The final moment: you realize what could have been."
  },
  {
    id: "she_didnt_choose_you", 
    title: "She checked your phone at 3AM",
    emoji: "💔",
    outcome: "Everything changed in one moment",
    story: "You prepare to confess your feelings. She walks toward someone else. Her smile breaks your heart."
  },
  {
    id: "future_you",
    title: "Your future self came back… with a warning",
    emoji: "✨",
    outcome: "The message you needed to hear",
    story: "A stronger, wiser version of you appears. They look at you with knowing eyes. They say one thing before disappearing."
  },
  {
    id: "lost_someone",
    title: "Your dog spoke to you one last time",
    emoji: "🕯️",
    outcome: "A goodbye you'll never forget",
    story: "Flashes of memory with someone important. They slowly fade away. You are left alone with the echo of what was."
  },
  {
    id: "last_person",
    title: "The group chat after you left",
    emoji: "💬",
    outcome: "What they really said about you",
    story: "You walk through an empty world. You search for someone, anyone. Silence is the only response."
  },
  {
    id: "what_could_have_been",
    title: "What Could Have Been",
    emoji: "🌠",
    outcome: "Watch yourself in the life you didn't choose",
    story: "You see another version of yourself living a different life. You watch them with longing. The final moment: you realize what could have been."
  },
  {
    id: "breaking_news",
    title: "Your friend betrayed you (and you saw it happen)",
    emoji: "📰",
    outcome: "The truth you weren't ready for",
    description: "Add your friend's photo — put them on the news",
    story: "Breaking news intro with police lights. The uploaded person appears as central figure in developing situation. Witnesses react. Close-up of confused face. Twist reveal - harmless misunderstanding. Reporter awkward smile. End: 'Send this to them 😂'"
  },
  {
    id: "custom",
    title: "✍️ Your Story",
    emoji: "✨",
    outcome: "Write your own narrative",
    story: ""
  }
];

export default function CreatePage() {
  const [mainPhoto, setMainPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [extraPhotos, setExtraPhotos] = useState<CharacterPhoto[]>(
    Array(6).fill(null).map(() => ({ file: null, url: null }))
  );
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [friendPhoto, setFriendPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [userSelfPhoto, setUserSelfPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [story, setStory] = useState("");
  const [customStory, setCustomStory] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const mainPhotoRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const extraPhotoRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const ADMIN_USER_ID = 'e01310e2-41dc-46b5-818e-a6104f48796a';
      
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        // Use admin ID for testing when not logged in
        setUserId(ADMIN_USER_ID);
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
    
    // Special handling for prank template - show friend modal
    if (template.id === 'breaking_news' && !friendPhoto.file) {
      setShowFriendModal(true);
      return;
    }
    
    // AUTO-ADVANCE: Scroll to upload area if no photo yet
    if (!mainPhoto.file && uploadAreaRef.current) {
      uploadAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add pulse highlight animation
      uploadAreaRef.current.style.animation = 'pulse-highlight 1.5s ease-in-out';
      setTimeout(() => {
        if (uploadAreaRef.current) {
          uploadAreaRef.current.style.animation = '';
        }
      }, 1500);
    }
  };

  const handleFriendPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFriendPhoto({ file, url: URL.createObjectURL(file) });
    setShowFriendModal(false);
  };
  
  const handleUserSelfPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUserSelfPhoto({ file, url: URL.createObjectURL(file) });
  };

  const handleGenerate = async () => {
    if (loading || !mainPhoto.file || !selectedTemplate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const mainFormData = new FormData();
      mainFormData.append('file', mainPhoto.file);
      const mainUploadRes = await fetch('/api/upload-photo', { 
        method: 'POST', 
        body: mainFormData 
      });
      const mainUploadData = await mainUploadRes.json();
      const mainPhotoUrl = mainUploadData.url;
      
      if (!mainPhotoUrl) throw new Error('Failed to upload main photo');
      
      console.log('[create] extraPhotos state:', extraPhotos)
      console.log('[create] friendPhoto state:', friendPhoto)
      console.log('[create] friendPhoto.file:', friendPhoto.file)
      console.log('[create] friendPhoto.url:', friendPhoto.url)
      console.log('[create] selectedTemplate:', selectedTemplate)
      console.log('[create] mainPhoto.file === friendPhoto.file?', mainPhoto.file === friendPhoto.file)
      
      const additionalImages: string[] = [];
      
      // For prank template: upload friend's photo as additional image
      // User's photo is already uploaded as mainPhotoUrl (@image_1)
      // Friend's photo goes to additional_images[0] (@image_2)
      if (selectedTemplate === 'breaking_news' && friendPhoto.file) {
        console.log('[create] uploading friend photo for prank...')
        const formData = new FormData()
        formData.append('file', friendPhoto.file)
        const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
        const data = await res.json()
        console.log('[create] friend photo upload response:', data)
        if (data.url) {
          additionalImages.push(data.url)
          console.log('[create] friend photo uploaded as additional_images[0]:', data.url)
        } else {
          console.error('[create] friend photo upload failed - no URL returned')
        }
      } else if (selectedTemplate === 'breaking_news') {
        console.log('[create] Prank template but no friendPhoto - only user will appear')
      }
      
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
      
      const body = {
        story: selectedTemplate === 'custom' ? (customStory || 'A personal story') : story,
        tier: "30s",
        userId: userId || crypto.randomUUID(),
        main_photo_url: mainPhotoUrl,
        additional_images: additionalImages,
        story_category: selectedTemplate
      };
      
      console.log('[create] SENDING body:', JSON.stringify(body))
      console.log('[create] additional_images count:', additionalImages?.length || 0)
      console.log('[create] additional_images:', additionalImages)
      
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

  const canGenerate = !!mainPhoto.file && !!selectedTemplate;
  const uploadedCount = extraPhotos.filter(p => p.file).length;

  return (
    <div style={{ 
      background: '#0a0a0a', 
      minHeight: '100vh', 
      color: 'white', 
      fontFamily: 'system-ui',
      paddingBottom: '120px'
    }}>
      
      {/* NAVIGATION BAR */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderBottom: '1px solid #1a1a1a',
        background: '#0a0a0a',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <a href="/" style={{
          color: '#D4A853',
          fontSize: '1.5rem',
          fontWeight: '700',
          textDecoration: 'none',
          letterSpacing: '0.05em'
        }}>
          ScriptFlow
        </a>
        
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="/my-videos" style={{
            color: '#888',
            fontSize: '1rem',
            textDecoration: 'none',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D4A853'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
          >
            My Movies
          </a>
          
          <a href="/credits" style={{
            color: '#888',
            fontSize: '1rem',
            textDecoration: 'none',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#D4A853'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#888'}
          >
            Credits
          </a>
        </div>
      </nav>
      
      {/* TOP SECTION */}
      <div style={{
        textAlign: 'center',
        padding: '40px 20px 20px 20px',
        borderBottom: '1px solid #1a1a1a'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '12px',
          background: 'linear-gradient(135deg, #D4A853 0%, #F4D03F 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Turn yourself into a cinematic story
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: '#888',
          margin: 0
        }}>
          Upload your photo · Choose your story · Get your movie in 60s
        </p>
      </div>

      <div style={{ 
        display: 'flex',
        minHeight: 'calc(100vh - 200px)',
        flexDirection: 'column'
      }}
      className="md:flex-row"
      >
        
        {/* LEFT PANEL: Upload Photo (35%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '40px 30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid #1a1a1a',
          minHeight: '200px'
        }}
        className="md:w-[35%] md:min-h-screen md:sticky md:top-0 md:h-screen md:p-10"
        >
          <div style={{ maxWidth: '450px', margin: '0 auto', width: '100%' }}>
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
              marginBottom: '24px'
            }}>
              Turn yourself into a cinematic story
            </p>

            {/* Start Here Label */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>👉</span>
              <p style={{ 
                color: '#D4A853', 
                fontSize: '1.1rem', 
                fontWeight: '700',
                margin: 0
              }}>
                Start Here — Upload Your Photo
              </p>
            </div>

            <input
              ref={mainPhotoRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleMainPhotoChange}
              style={{ display: 'none' }}
            />
            
            <div
              ref={uploadAreaRef}
              onClick={() => mainPhotoRef.current?.click()}
              style={{
                cursor: 'pointer',
                width: '100%',
                height: '400px',
                borderRadius: '20px',
                backgroundColor: mainPhoto.url ? 'transparent' : '#111',
                backgroundImage: mainPhoto.url ? `url(${mainPhoto.url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: mainPhoto.url ? '4px solid #D4A853' : '4px dashed #D4A853',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
              className="h-[200px] md:h-[400px]"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#F4D03F';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = mainPhoto.url ? '#D4A853' : '#D4A853';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {!mainPhoto.url && (
                <>
                  <div style={{ fontSize: '6rem', marginBottom: '20px' }}>👤</div>
                  <p style={{ color: '#D4A853', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                    Click to Upload
                  </p>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>
                    Your face will be the star
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
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.95)',
                    padding: '10px 20px',
                    borderRadius: '25px',
                    fontSize: '0.9rem',
                    color: '#D4A853',
                    border: '2px solid #D4A853',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  ✏️ Change Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Choose Story (65%) */}
        <div style={{
          width: '100%',
          background: '#0a0a0a',
          padding: '40px 30px 20px 30px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        className="md:w-[65%] md:p-10"
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <h2 style={{ 
              margin: '0 0 24px 0', 
              fontSize: '2rem', 
              fontWeight: '700',
              color: '#fff'
            }}>
              Choose Your Story
            </h2>

            {/* 2-Column Card Grid - Tighter spacing */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              marginBottom: '20px'
            }}
            className="grid-cols-1 sm:grid-cols-2"
            >
              {TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  onClick={() => {
                    if (template.id === 'custom') {
                      setSelectedTemplate('custom')
                    } else {
                      handleTemplateClick(template)
                    }
                  }}
                  style={{
                    background: selectedTemplate === template.id ? 'linear-gradient(135deg, #D4A853 0%, #B8923F 100%)' : '#111',
                    border: selectedTemplate === template.id ? '3px solid #F4D03F' : '1px solid #222',
                    borderRadius: '14px',
                    padding: '16px',
                    cursor: template.id === 'custom' && selectedTemplate === 'custom' ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    transform: selectedTemplate === template.id ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: selectedTemplate === template.id ? '0 0 25px rgba(244,208,63,0.6)' : 'none',
                    opacity: selectedTemplate && selectedTemplate !== template.id ? 0.6 : 1,
                    minHeight: template.id === 'custom' && selectedTemplate === 'custom' ? '250px' : '130px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTemplate !== template.id && !(template.id === 'custom' && selectedTemplate === 'custom')) {
                      e.currentTarget.style.transform = 'scale(1.01)';
                      e.currentTarget.style.borderColor = '#444';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTemplate !== template.id) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = '#222';
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontSize: '2.2rem' }}>
                      {template.emoji}
                    </div>
                    {template.id === 'breaking_news' && (
                      <div style={{
                        background: 'linear-gradient(135deg, #ff4444 0%, #ff6b6b 100%)',
                        color: '#fff',
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        🔥 Viral
                      </div>
                    )}
                  </div>
                  <h3 style={{ 
                    margin: '0 0 6px 0', 
                    fontSize: '1.05rem', 
                    fontWeight: '700',
                    color: selectedTemplate === template.id ? '#000' : '#fff'
                  }}>
                    {template.title}
                  </h3>
                  
                  {/* Show textarea inside custom card when selected */}
                  {template.id === 'custom' && selectedTemplate === 'custom' ? (
                    <textarea
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation()
                        setCustomStory(e.target.value)
                      }}
                      value={customStory}
                      placeholder="Describe your story... What happened? What do you feel?"
                      autoFocus
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        background: '#1a1a1a',
                        border: '1px solid #D4A853',
                        borderRadius: '8px',
                        padding: '10px',
                        color: 'white',
                        fontSize: '0.85rem',
                        resize: 'none',
                        cursor: 'text',
                        pointerEvents: 'all',
                        position: 'relative',
                        zIndex: 10,
                        fontFamily: 'system-ui',
                        lineHeight: '1.5',
                        marginTop: '8px'
                      }}
                    />
                  ) : (
                    <p style={{ 
                      margin: 0, 
                      fontSize: '0.8rem',
                      color: selectedTemplate === template.id ? 'rgba(0,0,0,0.7)' : '#888',
                      lineHeight: 1.3,
                      flex: 1
                    }}>
                      {template.outcome}
                    </p>
                  )}
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
          </div>
        </div>
      </div>

      {/* STICKY CTA BUTTON - Always Visible */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        background: 'linear-gradient(to top, #0a0a0a 95%, transparent)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}
      className="md:left-[35%] md:items-end md:pr-10"
      >
        {/* Add More Characters Link - Above CTA */}
        <button
          onClick={() => setShowExtraModal(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            fontSize: '0.8rem',
            cursor: 'pointer',
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
          onClick={async () => {
            if (loading || !canGenerate) return;
            
            setLoading(true);
            setError(null);
            
            try {
              const ADMIN_USER_ID = 'e01310e2-41dc-46b5-818e-a6104f48796a';
              
              const mainFormData = new FormData();
              mainFormData.append('file', mainPhoto.file!);
              const mainUploadRes = await fetch('/api/upload-photo', { 
                method: 'POST', 
                body: mainFormData 
              });
              const mainUploadData = await mainUploadRes.json();
              const mainPhotoUrl = mainUploadData.url;
              
              if (!mainPhotoUrl) throw new Error('Failed to upload main photo');
              
              const additionalImages: string[] = [];
              
              if (selectedTemplate === 'breaking_news' && friendPhoto.file) {
                const formData = new FormData();
                formData.append('file', friendPhoto.file);
                const res = await fetch('/api/upload-photo', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.url) additionalImages.push(data.url);
              }
              
              for (const photo of extraPhotos) {
                if (photo.file) {
                  const form = new FormData();
                  form.append('file', photo.file);
                  const res = await fetch('/api/upload-photo', { method: 'POST', body: form });
                  const data = await res.json();
                  if (data.url) additionalImages.push(data.url);
                }
              }
              
              const finalStory = selectedTemplate === 'custom' ? customStory : story;
              
              if (userId === ADMIN_USER_ID) {
                const res = await fetch('/api/movie/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: userId,
                    story: finalStory,
                    tier: "30s",
                    main_photo_url: mainPhotoUrl,
                    additional_images: additionalImages,
                    story_category: selectedTemplate
                  })
                });
                
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.error || 'Failed to create movie');
                if (!data.movieId) throw new Error('No movie ID returned');
                
                router.push(`/movie/${data.movieId}`);
              } else {
                const res = await fetch('/api/stripe/movie-checkout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: userId || crypto.randomUUID(),
                    story: finalStory,
                    tier: "30s",
                    main_photo_url: mainPhotoUrl,
                    additional_images: additionalImages,
                    story_category: selectedTemplate
                  })
                });
                
                const data = await res.json();
                
                if (data.checkoutUrl || data.url) {
                  window.location.href = data.checkoutUrl || data.url;
                } else {
                  throw new Error(data.error || 'Payment setup failed');
                }
              }
            } catch (e: any) {
              setError(e.message);
              setLoading(false);
            }
          }}
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
            boxShadow: canGenerate && !loading ? '0 10px 40px rgba(212,168,83,0.5)' : 'none',
            maxWidth: '700px',
            width: '100%',
            textAlign: 'center',
            animation: canGenerate && !loading ? 'pulse 2s ease-in-out infinite' : 'none'
          }}
          onMouseEnter={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 15px 50px rgba(212,168,83,0.6)';
            }
          }}
          onMouseLeave={(e) => {
            if (canGenerate && !loading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(212,168,83,0.5)';
            }
          }}
        >
          {loading ? (
            '✨ Processing...'
          ) : canGenerate ? (
            '💳 Pay $2.9 → Generate Movie'
          ) : (
            'Upload photo to continue'
          )}
        </button>
      </div>

      {/* Friend Photo Modal (for Prank Template) */}
      {showFriendModal && (
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
          onClick={() => setShowFriendModal(false)}
        >
          <div 
            style={{
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '450px',
              width: '100%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ 
              color: '#D4A853', 
              fontSize: '1.8rem', 
              margin: '0 0 8px 0',
              textAlign: 'center'
            }}>
              Who's getting pranked? 😂
            </h2>
            
            <p style={{ 
              color: '#888', 
              fontSize: '1rem', 
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              Add Your Friend's Photo (Required)
            </p>

            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFriendPhotoChange}
              style={{ display: 'none' }}
              id="friend-photo-input"
            />
            
            <label
              htmlFor="friend-photo-input"
              style={{
                cursor: 'pointer',
                width: '100%',
                height: '300px',
                borderRadius: '20px',
                background: friendPhoto.url ? `url(${friendPhoto.url})` : '#111',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '4px dashed #D4A853',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                marginBottom: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#F4D03F';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#D4A853';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {!friendPhoto.url && (
                <>
                  <div style={{ fontSize: '5rem', marginBottom: '16px' }}>👤</div>
                  <p style={{ color: '#D4A853', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                    Click to Upload
                  </p>
                  <p style={{ color: '#666', fontSize: '0.85rem', marginTop: '8px' }}>
                    Your friend will be the star of this video
                  </p>
                </>
              )}
            </label>

            {friendPhoto.file && (
              <>
                <div style={{ marginTop: '24px', marginBottom: '16px' }}>
                  <p style={{ 
                    color: '#D4A853', 
                    fontSize: '1rem', 
                    fontWeight: '700',
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    Add YOUR photo (optional)
                  </p>
                  <p style={{ 
                    color: '#666', 
                    fontSize: '0.85rem', 
                    marginBottom: '12px',
                    textAlign: 'center'
                  }}>
                    Appear in the scene laughing at the prank
                  </p>
                  
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleUserSelfPhotoChange}
                    style={{ display: 'none' }}
                    id="user-self-photo-input"
                  />
                  
                  <label
                    htmlFor="user-self-photo-input"
                    style={{
                      cursor: 'pointer',
                      width: '100%',
                      height: '150px',
                      borderRadius: '12px',
                      background: userSelfPhoto.url ? `url(${userSelfPhoto.url})` : '#1a1a1a',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: '2px dashed #666',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#D4A853';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#666';
                    }}
                  >
                    {!userSelfPhoto.url && (
                      <>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>😂</div>
                        <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                          Click to add yourself
                        </p>
                      </>
                    )}
                  </label>
                </div>
                
                <button
                  onClick={() => {
                    setShowFriendModal(false);
                  }}
                  style={{
                    width: '100%',
                    background: '#D4A853',
                    color: '#000',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Continue →
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
                      <div style={{ fontSize: '2rem', color: '#555' }}>+</div>
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
        @keyframes pulse {
          0%, 100% { box-shadow: 0 10px 40px rgba(212,168,83,0.5); }
          50% { box-shadow: 0 10px 40px rgba(212,168,83,0.7); }
        }
        @keyframes pulse-highlight {
          0%, 100% { 
            border-color: #D4A853;
            box-shadow: 0 0 0 rgba(212,168,83,0);
          }
          50% { 
            border-color: #F4D03F;
            box-shadow: 0 0 30px rgba(244,208,63,0.6);
          }
        }
      `}</style>
    </div>
  );
}
