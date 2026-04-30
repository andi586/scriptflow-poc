"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const HOOKS = [
  "I caught my girlfriend cheating…",
  "My boss humiliated me, I got revenge…",
  "I met my future self…",
  "My best friend betrayed me…",
  "My pet saved my life…",
  "My dog's last message to me…",
  "She checked my phone at 3AM…",
];

export default function CreatePage() {
  const [story, setStory] = useState(HOOKS[0]);
  const [photo, setPhoto] = useState<{ file: File | null; url: string | null }>({ file: null, url: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-xl w-full space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">
            🔥 See yourself in a viral movie
          </h1>
          <p className="text-neutral-400 text-sm">
            Your face. Your story. Ready in 60 seconds.
          </p>
        </div>

        {/* Step 1: Choose Story */}
        <div className="text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-yellow-400 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <h2 className="text-lg font-semibold">Choose your story</h2>
          </div>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={3}
            className="w-full p-4 rounded-lg bg-neutral-900 border border-neutral-700 text-white mb-3"
            placeholder="Write your own or pick one below..."
          />
          <div className="flex flex-wrap gap-2">
            {HOOKS.map((h, i) => (
              <button
                key={i}
                onClick={() => setStory(h)}
                className="px-3 py-2 bg-neutral-800 rounded-lg text-xs hover:bg-neutral-700 transition"
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Add Photo */}
        <div className="text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-yellow-400 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <h2 className="text-lg font-semibold">Add your face</h2>
            <span className="text-red-400 text-sm font-semibold">REQUIRED</span>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-neutral-700 rounded-lg p-6 hover:border-yellow-400 transition"
          >
            {photo.url ? (
              <div className="flex items-center gap-4">
                <img
                  src={photo.url}
                  alt="Your photo"
                  className="w-20 h-20 rounded-full object-cover border-2 border-yellow-400"
                />
                <div className="text-left">
                  <p className="text-green-400 font-semibold">✓ Photo uploaded</p>
                  <p className="text-neutral-400 text-sm">Click to change</p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-neutral-300 font-semibold">Click to upload your photo</p>
                <p className="text-neutral-500 text-sm mt-1">This is what makes you the star</p>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Generate */}
        <div className="text-left">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-yellow-400 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <h2 className="text-lg font-semibold">Generate your movie</h2>
          </div>
          
          {error && (
            <p className="text-red-400 text-sm mb-3 bg-red-950 border border-red-800 rounded-lg p-3">
              {error}
            </p>
          )}
          
          <button
            onClick={handleGenerate}
            disabled={loading || !photo.file}
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              loading || !photo.file
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-yellow-400 text-black hover:bg-yellow-500"
            }`}
          >
            {loading ? "🎬 Generating..." : "🎬 Generate My Viral Movie"}
          </button>
          <p className="text-sm text-neutral-400 text-center mt-2">⚡ Ready in 60 seconds</p>
        </div>

        {/* Benefits */}
        <div className="text-sm text-neutral-400 text-center space-y-1 pt-4 border-t border-neutral-800">
          <p>• You as the main character</p>
          <p>• Cinematic scenes + AI voice</p>
          <p>• Ready for TikTok in 60 seconds</p>
        </div>
      </div>
    </div>
  );
}
