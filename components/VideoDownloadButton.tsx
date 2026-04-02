"use client";

import { useState } from "react";
import { Download } from "lucide-react";

type Props = {
  videoUrl: string;
  filename?: string;
  /** Label shown on iOS devices */
  iosLabel?: string;
  /** Label shown on Android / desktop */
  defaultLabel?: string;
  className?: string;
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function VideoDownloadButton({
  videoUrl,
  filename = "episode.mp4",
  iosLabel = "Save to iPhone 📱",
  defaultLabel = "Download Episode ⬇️",
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proxyUrl = `/api/video/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const isIOS = detectIOS();
    console.log("[VideoDownloadButton] isIOS:", isIOS, "| videoUrl:", videoUrl.slice(0, 80));

    try {
      if (isIOS) {
        // iOS: fetch via proxy → Blob → navigator.share (Web Share API)
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: "video/mp4" });

        console.log("[VideoDownloadButton] canShare files:", navigator.canShare?.({ files: [file] }));

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
        } else {
          // Fallback: open in new tab with instruction
          window.open(videoUrl, "_blank");
          alert("Tap Share (□↑) → Save to Photos");
        }
      } else {
        // Android / Desktop: trigger download via <a download>
        const a = document.createElement("a");
        a.href = proxyUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // User cancelled share sheet — not an error
        console.log("[VideoDownloadButton] share cancelled by user");
      } else {
        console.error("[VideoDownloadButton] error:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const isIOS = typeof window !== "undefined" ? detectIOS() : false;
  const label = isIOS ? iosLabel : defaultLabel;

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleClick()}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-wait w-full ${className}`}
      >
        {busy ? (
          <>
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            Preparing your film…
          </>
        ) : (
          <>
            <Download className="size-4" aria-hidden />
            {label}
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-400 text-center" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
