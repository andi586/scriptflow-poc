"use client";

import { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import {
  VOICE_STYLE_PARAMS,
  BEAUTY_STYLE_PARAMS,
  PREVIEW_TIER_CONFIG,
  PRICING,
  type VoiceStyle,
  type BeautyStyle,
  type GenerationTier,
} from "@/lib/generation-tiers";

const STORAGE_KEY = "scriptflow_star_photos";

interface SavedPhoto {
  dataUrl: string;
  name: string;
  savedAt: string;
}

type PagePhase = "input" | "processing" | "preview_ready" | "full_generating" | "full_ready";

export default function BeTheStarPage() {
  // ── Photo Memory State ──────────────────────────────────────────────
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const [currentPhotos, setCurrentPhotos] = useState<SavedPhoto[]>([]);
  const [showSavedPrompt, setShowSavedPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Script / Story State ────────────────────────────────────────────
  const [storyText, setStoryText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [translationNote, setTranslationNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Generation Phase ────────────────────────────────────────────────
  const [pagePhase, setPagePhase] = useState<PagePhase>("input");
  const [generationTier, setGenerationTier] = useState<GenerationTier>("preview");
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [fullResult, setFullResult] = useState<Record<string, unknown> | null>(null);

  // ── Voice & Beauty Selections ───────────────────────────────────────
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("natural");
  const [beautyStyle, setBeautyStyle] = useState<BeautyStyle>("natural");

  // ── Load saved photos from localStorage on mount ────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const photos: SavedPhoto[] = JSON.parse(raw);
        if (photos.length > 0) {
          setSavedPhotos(photos);
          setShowSavedPrompt(true);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ── Save photos to localStorage whenever currentPhotos changes ──────
  useEffect(() => {
    if (currentPhotos.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPhotos));
        setSavedPhotos(currentPhotos);
      } catch {
        // ignore storage errors
      }
    }
  }, [currentPhotos]);

  // ── Handle file upload ──────────────────────────────────────────────
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const readers = files.map(
      (file) =>
        new Promise<SavedPhoto>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              dataUrl: reader.result as string,
              name: file.name,
              savedAt: new Date().toISOString(),
            });
          };
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers).then((photos) => {
      setCurrentPhotos(photos);
      setShowSavedPrompt(false);
    });
  }

  function useSavedPhotos() {
    setCurrentPhotos(savedPhotos);
    setShowSavedPrompt(false);
  }

  function uploadNew() {
    setShowSavedPrompt(false);
    fileInputRef.current?.click();
  }

  function removePhoto(index: number) {
    setCurrentPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Phase 1: Generate preview (3 shots, 480p, watermark) ────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!storyText.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setPreviewResult(null);
    setTranslationNote(null);
    setPagePhase("processing");

    try {
      // Step 1: Auto-detect language and translate if needed
      let scriptToProcess = storyText.trim();
      let wasTranslated = false;

      const translateRes = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scriptToProcess }),
      });

      if (translateRes.ok) {
        const translateData = await translateRes.json();
        if (translateData.wasTranslated) {
          scriptToProcess = translateData.translated;
          wasTranslated = true;
        }
      }

      if (wasTranslated) {
        setTranslationNote("✓ Translated to English for best results");
      }

      // Step 2: Parse narrative (preview tier: first 3 shots)
      const nelRes = await fetch("/api/narrative/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptToProcess,
          starPhotos: currentPhotos.map((p) => ({ dataUrl: p.dataUrl, name: p.name })),
          tier: "preview",
          maxShots: PREVIEW_TIER_CONFIG.maxShots,
          voiceStyle,
          beautyStyle,
        }),
      });

      if (!nelRes.ok) {
        const errData = await nelRes.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || `Server error: ${nelRes.status}`);
      }

      const data = await nelRes.json();
      setPreviewResult(data);
      setGenerationTier("preview");
      setPagePhase("preview_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPagePhase("input");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Phase 2: Unlock full movie (triggered after payment) ────────────
  async function handleUnlockFull() {
    // In production: trigger Stripe checkout, then on payment_status='paid' call full generation
    // For now: simulate payment success and trigger full generation
    setPagePhase("full_generating");
    setGenerationTier("full");

    try {
      await new Promise((r) => setTimeout(r, 2000)); // simulate full generation
      setFullResult({ ...previewResult, tier: "full", shots: 5, resolution: "1080p" });
      setPagePhase("full_ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Full generation failed");
      setPagePhase("preview_ready");
    }
  }

  function handleMakeAnother() {
    setPagePhase("input");
    setPreviewResult(null);
    setFullResult(null);
    setGenerationTier("preview");
    setStoryText("");
    setError(null);
    setTranslationNote(null);
  }

  // ─── PHASE: PROCESSING ──────────────────────────────────────────────
  if (pagePhase === "processing") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        <p className="text-white/70 text-sm tracking-wide">Generating your preview…</p>
        <p className="text-white/40 text-xs">
          {PREVIEW_TIER_CONFIG.maxShots} shots · {PREVIEW_TIER_CONFIG.resolution} · watermark
        </p>
      </div>
    );
  }

  // ─── PHASE: FULL GENERATING ─────────────────────────────────────────
  if (pagePhase === "full_generating") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        <p className="text-white/70 text-sm tracking-wide">Generating your full movie…</p>
        <p className="text-white/40 text-xs">5 shots · 1080p · no watermark</p>
      </div>
    );
  }

  // ─── PHASE: PREVIEW READY (paywall) ────────────────────────────────
  if (pagePhase === "preview_ready") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-16">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(600px_circle_at_50%_40%,rgba(245,158,11,0.12),transparent_60%)]" />

        {/* Preview badge */}
        <div className="mb-6 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/60 font-medium">
          Preview · {PREVIEW_TIER_CONFIG.maxShots} shots · {PREVIEW_TIER_CONFIG.resolution} · watermark
        </div>

        <p className="text-white text-2xl font-semibold text-center mb-2">
          Your movie is ready.
        </p>
        <p className="text-white/40 text-sm text-center mb-8">
          Unlock the full 5-shot 1080p version
        </p>

        {/* Preview result summary */}
        {previewResult && (
          <div className="w-full max-w-sm mb-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/40 mb-2">Preview generated with:</p>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-white/70">
                {VOICE_STYLE_PARAMS[voiceStyle].emoji} {VOICE_STYLE_PARAMS[voiceStyle].label} voice
              </span>
              <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-white/70">
                {BEAUTY_STYLE_PARAMS[beautyStyle].emoji} {BEAUTY_STYLE_PARAMS[beautyStyle].label} look
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {/* Unlock Full Movie */}
          <button
            type="button"
            className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-base hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/30"
            onClick={handleUnlockFull}
          >
            🎬 Unlock Full Movie — ${PRICING.fullMovie}
          </button>

          {/* Unlimited subscription */}
          <button
            type="button"
            className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base hover:bg-white/15 transition-all"
            onClick={handleUnlockFull}
          >
            ∞ Unlimited — ${PRICING.unlimited}/mo
          </button>

          {/* Make Another */}
          <button
            type="button"
            className="w-full py-3 rounded-2xl text-white/60 text-sm hover:text-white/80 transition-colors"
            onClick={handleMakeAnother}
          >
            Make Another
          </button>
        </div>
      </div>
    );
  }

  // ─── PHASE: FULL READY ──────────────────────────────────────────────
  if (pagePhase === "full_ready") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-16">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(600px_circle_at_50%_40%,rgba(245,158,11,0.15),transparent_60%)]" />

        <div className="mb-4 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs text-amber-400 font-medium">
          ✓ Full Movie · 5 shots · 1080p · No watermark
        </div>

        <p className="text-white text-2xl font-semibold text-center mb-8">
          Your full movie is ready! 🎬
        </p>

        <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 mb-8">
          <h3 className="mb-3 text-base font-semibold text-emerald-400">✓ Generated!</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-white/70">
            {JSON.stringify(fullResult, null, 2)}
          </pre>
        </div>

        <button
          type="button"
          className="px-8 py-3 rounded-2xl text-white/60 text-sm hover:text-white/80 transition-colors"
          onClick={handleMakeAnother}
        >
          Make Another
        </button>
      </div>
    );
  }

  // ─── PHASE: INPUT ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(800px_circle_at_20%_20%,rgba(245,158,11,0.15),transparent_55%),radial-gradient(600px_circle_at_80%_80%,rgba(139,92,246,0.12),transparent_55%)]" />

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-2 text-sm font-semibold uppercase tracking-widest text-amber-400">
            ScriptFlow
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Be the Star ⭐
          </h1>
          <p className="mt-3 text-white/60">
            Upload your photos and tell your story — in any language
          </p>
        </div>

        {/* ── Photo Memory ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">📸 Your Photos</h2>

          {showSavedPrompt && savedPhotos.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="mb-3 text-sm font-medium text-amber-300">Use your saved photos?</p>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {savedPhotos.slice(0, 4).map((photo, i) => (
                  <img
                    key={i}
                    src={photo.dataUrl}
                    alt={photo.name}
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/20"
                  />
                ))}
                {savedPhotos.length > 4 && (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-sm text-white/60">
                    +{savedPhotos.length - 4}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={useSavedPhotos}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
                >
                  Yes ✓
                </button>
                <button
                  type="button"
                  onClick={uploadNew}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Upload new
                </button>
              </div>
            </div>
          )}

          {currentPhotos.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-3">
                {currentPhotos.map((photo, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={photo.dataUrl}
                      alt={photo.name}
                      className="h-24 w-24 rounded-xl object-cover ring-1 ring-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/40">✓ Photos saved — will be remembered next time</p>
            </div>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-5 py-3 text-sm text-white/60 transition hover:border-amber-500/50 hover:text-amber-400"
            >
              <span className="text-lg">+</span>
              {currentPhotos.length > 0 ? "Change photos" : "Upload your photos"}
            </button>
          </div>
        </section>

        {/* ── Voice Style ──────────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-1 text-lg font-semibold">🎤 How do you want to sound?</h2>
          <p className="mb-4 text-xs text-white/40">Choose your voice style</p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(VOICE_STYLE_PARAMS) as [VoiceStyle, typeof VOICE_STYLE_PARAMS[VoiceStyle]][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVoiceStyle(key)}
                  className={`
                    relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition
                    ${voiceStyle === key
                      ? "border-amber-500 bg-amber-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
                    }
                  `}
                >
                  {cfg.isPaid && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      PRO
                    </span>
                  )}
                  <span className="text-2xl">{cfg.emoji}</span>
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className="text-xs opacity-60">{cfg.description}</span>
                </button>
              )
            )}
          </div>
        </section>

        {/* ── Beauty Style ─────────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-1 text-lg font-semibold">✨ How do you want to look?</h2>
          <p className="mb-4 text-xs text-white/40">Choose your visual style</p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(BEAUTY_STYLE_PARAMS) as [BeautyStyle, typeof BEAUTY_STYLE_PARAMS[BeautyStyle]][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBeautyStyle(key)}
                  className={`
                    relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition
                    ${beautyStyle === key
                      ? "border-amber-500 bg-amber-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
                    }
                  `}
                >
                  {cfg.isPaid && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      PRO
                    </span>
                  )}
                  <span className="text-2xl">{cfg.emoji}</span>
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className="text-xs opacity-60">{cfg.description}</span>
                </button>
              )
            )}
          </div>
        </section>

        {/* ── Story Input ──────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="mb-1 text-lg font-semibold">🌍 Your Story</h2>
            <p className="mb-4 text-xs text-white/40">
              Speak or type in any language — we&apos;ll handle the rest
            </p>

            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              rows={6}
              placeholder={
                "Speak or type in any language...\n用任何语言说出你的故事\nHabla en cualquier idioma...\nどんな言語でも話せます"
              }
              className="w-full resize-none rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />

            {translationNote && (
              <p className="mt-2 text-xs text-emerald-400">{translationNote}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {["中文", "日本語", "한국어", "Español", "Français", "العربية", "हिन्दी", "Português", "Deutsch", "Italiano"].map(
                (lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/40"
                  >
                    {lang}
                  </span>
                )
              )}
            </div>
          </section>

          {/* Preview tier info */}
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-amber-400 text-sm">🎬</span>
            <div className="flex-1">
              <p className="text-xs text-white/60">
                Free preview: {PREVIEW_TIER_CONFIG.maxShots} shots · {PREVIEW_TIER_CONFIG.resolution} · watermark
              </p>
              <p className="text-xs text-white/30">Unlock full 5-shot 1080p for ${PRICING.fullMovie}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !storyText.trim()}
            className="w-full rounded-xl bg-amber-500 py-3.5 text-base font-semibold text-black shadow-[0_10px_30px_-12px_rgba(245,158,11,0.75)] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating preview...
              </span>
            ) : (
              "✨ Generate Preview (Free)"
            )}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
