"use client";
import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/movie/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          story,
          tier: "30s",
          userId: "2877b339-1f39-4871-92f4-e638d63b5d09"
        }),
      });
      const data = await res.json();
      router.push(`/movie/${data.movieId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-xl w-full">
        <h1 className="text-3xl font-bold mb-4">
          🔥 See yourself in a viral movie
        </h1>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={3}
          className="w-full p-4 rounded-lg bg-neutral-900 border border-neutral-700 mb-4 text-white"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-yellow-400 text-black py-4 rounded-xl font-bold text-lg mb-2"
        >
          {loading ? "Generating..." : "🎬 Generate My Viral Movie"}
        </button>
        <p className="text-sm text-neutral-400">⚡ Ready in 60 seconds</p>
      </div>

      <div className="mt-10 max-w-xl w-full">
        <p className="text-neutral-400 mb-3">Pick a viral story:</p>
        <div className="flex flex-wrap gap-2">
          {HOOKS.map((h, i) => (
            <button
              key={i}
              onClick={() => setStory(h)}
              className="px-3 py-2 bg-neutral-800 rounded-lg text-sm hover:bg-neutral-700"
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 text-sm text-neutral-400 text-center space-y-1">
        <p>• You as the main character</p>
        <p>• Cinematic scenes + AI voice</p>
        <p>• Ready for TikTok in 60 seconds</p>
      </div>
    </div>
  );
}
