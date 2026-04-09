"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── First lines NEL would generate ───────────────────────────────────────────
const FIRST_LINES = [
  "I never thought this day would come... but here I am.",
  "They said I wasn't good enough. They were wrong.",
  "Every story has a beginning. This is mine.",
  "I've been waiting for this moment my entire life.",
  "The world is about to change. And I'm the one changing it.",
];

type Phase = "upload" | "generating" | "result";

export default function BeTheStarPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState(FIRST_LINES[0]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Upload photo directly to Supabase ──────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPhotoPreview(localUrl);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.type.includes("png") ? "png" : "jpg";
      const filePath = `be-the-star/${Date.now()}_photo.${ext}`;
      const { data, error: uploadErr } = await supabase.storage
        .from("recordings")
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        setError("Photo upload failed: " + uploadErr.message);
        return;
      }

      const url = supabase.storage.from("recordings").getPublicUrl(data.path).data.publicUrl;
      setPhotoUrl(url);
      console.log("[be-the-star] photo uploaded:", url);
    } catch (err) {
      setError("Upload error: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // ── Generate preview video ─────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!photoUrl) {
      setError("Please upload a photo first.");
      return;
    }

    setPhase("generating");
    setError(null);
    setStep("Generating your character voice...");

    try {
      const res = await fetch("/api/be-the-star/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: photoUrl, firstLine }),
      });

      setStep("Animating your character...");
      const data = await res.json();

      if (!res.ok || !data.videoUrl) {
        throw new Error(data.error ?? "Generation failed");
      }

      setVideoUrl(data.videoUrl);
      setPhase("result");

      // Auto-play after short delay
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPhase("upload");
    }
  }, [photoUrl, firstLine]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPhase("upload");
    setPhotoUrl(null);
    setPhotoPreview(null);
    setVideoUrl(null);
    setError(null);
    setStep("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: GENERATING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "generating") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-14 h-14 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-white/70 text-sm tracking-wide">{step || "Creating your character..."}</p>
        <p className="text-white/30 text-xs">This takes about 30–60 seconds</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "result" && videoUrl) {
    return (
      <div className="fixed inset-0 bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          autoPlay
          controls
          loop
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-4 z-10">
          <p className="text-white text-xl font-bold text-center drop-shadow-lg">
            Meet your character. 🎬
          </p>
          <p className="text-white/60 text-sm text-center max-w-xs">
            &ldquo;{firstLine}&rdquo;
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <a
              href={videoUrl}
              download="my-character.mp4"
              className="flex-1 py-3 rounded-2xl bg-purple-600 text-white font-bold text-sm text-center hover:bg-purple-500 transition"
            >
              ⬇️ Download
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/15 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: UPLOAD
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(700px_circle_at_50%_20%,rgba(139,92,246,0.18),transparent_60%)]" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-400">ScriptFlow</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Be the Star 🌟</h1>
          <p className="mt-2 text-white/50 text-sm">Upload your photo and hear your character speak</p>
        </div>

        {/* Photo upload */}
        <div className="w-full mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            id="photo-input"
          />
          <label
            htmlFor="photo-input"
            className="block w-full cursor-pointer"
          >
            {photoPreview ? (
              <div className="relative w-full aspect-[3/4] max-h-72 rounded-2xl overflow-hidden border-2 border-purple-500/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Your photo"
                  className="w-full h-full object-cover"
                />
                {!photoUrl && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </div>
                )}
                {photoUrl && (
                  <div className="absolute top-3 right-3 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                    ✓
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full aspect-[3/4] max-h-72 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3 hover:border-purple-500/50 hover:bg-white/8 transition">
                <div className="text-4xl">📸</div>
                <p className="text-white/60 text-sm">Tap to upload your photo</p>
                <p className="text-white/30 text-xs">JPG, PNG, WEBP</p>
              </div>
            )}
          </label>
        </div>

        {/* First line selector */}
        <div className="w-full mb-6">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Your character&apos;s first line</p>
          <div className="flex flex-col gap-2">
            {FIRST_LINES.map((line, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFirstLine(line)}
                className={[
                  "w-full text-left px-4 py-3 rounded-xl border text-sm transition",
                  firstLine === line
                    ? "border-purple-500 bg-purple-500/10 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80",
                ].join(" ")}
              >
                &ldquo;{line}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-400 text-center">{error}</p>}

        {/* CTA */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!photoUrl}
          className={[
            "w-full py-4 rounded-2xl font-bold text-base transition-all shadow-lg",
            photoUrl
              ? "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/30 cursor-pointer"
              : "bg-white/10 text-white/30 cursor-not-allowed",
          ].join(" ")}
        >
          {photoUrl ? "✨ Generate My Character" : "Upload a photo first"}
        </button>
      </main>
    </div>
  );
}
