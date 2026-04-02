"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SavePageContent() {
  const searchParams = useSearchParams();
  const videoUrl = searchParams?.get("url") ?? "";
  const title = searchParams?.get("title") ?? "My Episode";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    // navigator.share with files is supported on iOS 15+ Safari and Android Chrome
    setShareSupported(
      typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function",
    );
  }, []);

  async function handleShare() {
    if (!videoUrl) return;
    setSharing(true);
    setShareError(null);
    setShareSuccess(false);

    // Debug: log support status to console
    console.log("[SavePage] navigator.share supported:", typeof navigator.share === "function");
    console.log("[SavePage] navigator.canShare supported:", typeof navigator.canShare === "function");

    try {
      // Try to share the actual video file first (iOS 15+)
      let sharedWithFile = false;
      if (typeof navigator.canShare === "function") {
        try {
          const response = await fetch(videoUrl);
          if (response.ok) {
            const blob = await response.blob();
            const fileName = title.replace(/[^a-zA-Z0-9_-]/g, "_") + ".mp4";
            const file = new File([blob], fileName, { type: "video/mp4" });
            console.log("[SavePage] canShare files:", navigator.canShare({ files: [file] }));
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title });
              sharedWithFile = true;
              setShareSuccess(true);
            }
          }
        } catch (fileErr) {
          console.warn("[SavePage] file share failed, falling back to URL share:", fileErr);
        }
      }

      // Fallback: share URL only — always triggers iOS share sheet
      if (!sharedWithFile) {
        console.log("[SavePage] falling back to URL-only share");
        await navigator.share({ url: videoUrl, title });
        setShareSuccess(true);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled — not an error
        console.log("[SavePage] share cancelled by user");
      } else {
        console.error("[SavePage] share error:", err);
        setShareError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSharing(false);
    }
  }

  if (!videoUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-sm text-white/50">No video URL provided.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="text-sm text-white/60 hover:text-white transition"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-white truncate">{title}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-6 max-w-lg mx-auto w-full">
        {/* Video player */}
        <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black">
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            className="w-full"
          />
        </div>

        {/* iOS long-press instruction */}
        <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center space-y-1">
          <p className="text-base font-semibold text-amber-200">
            📱 Press and hold the video
          </p>
          <p className="text-sm text-amber-200/80">
            → Save to Photos
          </p>
          <p className="text-xs text-white/40 mt-2">
            Works on iOS Safari — long-press the video above, then tap "Save to Photos"
          </p>
        </div>

        {/* Share button (navigator.share — iOS native share sheet) */}
        {shareSupported && (
          <div className="w-full space-y-2">
            <button
              type="button"
              disabled={sharing}
              onClick={() => void handleShare()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-4 text-base font-semibold text-sky-200 transition hover:bg-sky-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-wait"
            >
              {sharing ? (
                <>
                  <span className="inline-block size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                  Preparing…
                </>
              ) : (
                <>
                  <span className="text-lg">↗</span>
                  Share / Save to TikTok
                </>
              )}
            </button>
            <p className="text-[11px] text-white/40 text-center">
              Opens iOS share sheet — share directly to TikTok, Instagram, or save to Photos
            </p>
          </div>
        )}

        {shareError && (
          <p className="text-sm text-red-400 text-center" role="alert">
            Share failed: {shareError}
          </p>
        )}

        {shareSuccess && (
          <p className="text-sm text-emerald-400 text-center">
            ✓ Shared successfully!
          </p>
        )}

        {/* Fallback: copy URL */}
        <div className="w-full space-y-2">
          <p className="text-xs text-white/40 text-center">Or copy the video URL:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={videoUrl}
              className="flex-1 min-w-0 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white/70 outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(videoUrl).catch(() => {});
              }}
              className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/20 transition"
            >
              Copy
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SavePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <p className="text-sm text-white/50">Loading…</p>
        </div>
      }
    >
      <SavePageContent />
    </Suspense>
  );
}
