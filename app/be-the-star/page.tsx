"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── First lines ───────────────────────────────────────────────────────────────
const FIRST_LINES = [
  "我从来没有想到，这一天会来临。但我已经准备好了。",
  "他们说我不够好。但他们错了。",
  "每个故事都有开始。这是我的故事。",
  "我等待这一刻，等待了我整个人生。",
  "世界即将改变。而改变它的人，就是我。",
];

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120; // 120 × 5s = 10 minutes max

type Phase = "upload" | "submitting" | "polling" | "result";
type RecordingStatus = "idle" | "recording" | "processing" | "done" | "error";

export default function BeTheStarPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState(FIRST_LINES[0]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Voice recording state ──────────────────────────────────────────────────
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptsRef = useRef(0);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  // ── Upload photo directly to Supabase ──────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      if (uploadErr) { setError("Photo upload failed: " + uploadErr.message); return; }

      const url = supabase.storage.from("recordings").getPublicUrl(data.path).data.publicUrl;
      setPhotoUrl(url);
      console.log("[be-the-star] photo uploaded:", url);
    } catch (err) {
      setError("Upload error: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setRecordingError(null);
    setRecordingStatus("recording");
    setIsRecording(true);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingStatus("processing");

        try {
          const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType });
          const supabase = createClient();
          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const audioPath = `be-the-star/voice_${Date.now()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("recordings")
            .upload(audioPath, audioBlob, { contentType: mimeType, upsert: true });

          if (uploadErr) throw new Error("Voice upload failed: " + uploadErr.message);

          const { data: pub } = supabase.storage.from("recordings").getPublicUrl(audioPath);
          const url = pub.publicUrl;
          setVoiceRecordingUrl(url);
          setRecordingStatus("done");
          console.log("[be-the-star] voice recording uploaded:", url);
        } catch (e) {
          console.error("[be-the-star] voice upload failed:", e);
          setRecordingError(e instanceof Error ? e.message : "Upload failed");
          setRecordingStatus("error");
        }
      };

      recorder.start(100);

      // Auto-stop after 30 seconds
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    } catch (e) {
      console.error("[be-the-star] recording failed:", e);
      setIsRecording(false);
      setRecordingError(e instanceof Error ? e.message : "Could not access microphone");
      setRecordingStatus("error");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const clearVoiceRecording = useCallback(() => {
    setVoiceRecordingUrl(null);
    setRecordingStatus("idle");
    setRecordingError(null);
  }, []);

  // ── Poll OmniHuman status ──────────────────────────────────────────────────
  const schedulePoll = useCallback((tid: string) => {
    pollTimerRef.current = setTimeout(async () => {
      pollAttemptsRef.current += 1;
      setPollCount(pollAttemptsRef.current);

      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        setError("Generation timed out after 10 minutes. Please try again.");
        setPhase("upload");
        return;
      }

      try {
        const res = await fetch(`/api/be-the-star/poll?taskId=${encodeURIComponent(tid)}`);
        const data = await res.json();
        console.log(`[be-the-star] poll #${pollAttemptsRef.current} status:`, data.status);

        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setPhase("result");
          setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 300);
          return;
        }

        if (data.status === "failed") {
          setError("Generation failed: " + (data.error ?? "unknown error"));
          setPhase("upload");
          return;
        }

        // Still processing — schedule next poll
        schedulePoll(tid);
      } catch (err) {
        console.warn("[be-the-star] poll error:", err);
        // Network error — keep trying
        schedulePoll(tid);
      }
    }, POLL_INTERVAL_MS);
  }, []);

  // ── Submit job ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!photoUrl) { setError("Please upload a photo first."); return; }

    setPhase("submitting");
    setError(null);
    setStep("Generating your character voice...");
    pollAttemptsRef.current = 0;
    setPollCount(0);

    try {
      const res = await fetch("/api/be-the-star/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: photoUrl,
          firstLine,
          voiceRecordingUrl: voiceRecordingUrl ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.taskId) {
        throw new Error(data.error ?? "Submit failed");
      }

      console.log("[be-the-star] task submitted, taskId:", data.taskId);
      setTaskId(data.taskId);
      setStep("Animating your character...");
      setPhase("polling");
      schedulePoll(data.taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setPhase("upload");
    }
  }, [photoUrl, firstLine, voiceRecordingUrl, schedulePoll]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setPhase("upload");
    setPhotoUrl(null);
    setPhotoPreview(null);
    setVideoUrl(null);
    setTaskId(null);
    setError(null);
    setStep("");
    setPollCount(0);
    pollAttemptsRef.current = 0;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: SUBMITTING / POLLING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "submitting" || phase === "polling") {
    const elapsed = pollCount * (POLL_INTERVAL_MS / 1000);
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-14 h-14 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-white/70 text-sm tracking-wide text-center">
          {step || "Creating your character..."}
        </p>
        {phase === "polling" && (
          <p className="text-white/30 text-xs">
            {elapsed > 0 ? `${elapsed}s elapsed` : "Starting..."} · checking every 5s
          </p>
        )}
        {phase === "submitting" && (
          <p className="text-white/30 text-xs">Preparing audio & submitting...</p>
        )}
        {taskId && (
          <p className="text-white/20 text-xs font-mono">task: {taskId.slice(0, 16)}…</p>
        )}
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
          playsInline autoPlay controls loop
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
          <label htmlFor="photo-input" className="block w-full cursor-pointer">
            {photoPreview ? (
              <div className="relative w-full aspect-[3/4] max-h-72 rounded-2xl overflow-hidden border-2 border-purple-500/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover" />
                {!photoUrl && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </div>
                )}
                {photoUrl && (
                  <div className="absolute top-3 right-3 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">✓</div>
                )}
              </div>
            ) : (
              <div className="w-full aspect-[3/4] max-h-72 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3 hover:border-purple-500/50 transition">
                <div className="text-4xl">📸</div>
                <p className="text-white/60 text-sm">Tap to upload your photo</p>
                <p className="text-white/30 text-xs">JPG, PNG, WEBP</p>
              </div>
            )}
          </label>
        </div>

        {/* ── Voice recording section ──────────────────────────────────────── */}
        <div className="w-full mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-1">
            🎙️ Clone Your Voice <span className="text-white/30 normal-case font-normal">(optional)</span>
          </p>
          <p className="text-xs text-white/40 mb-3">
            Record 10–30 seconds of your voice to make the character sound like you.
          </p>

          {recordingStatus === "done" && voiceRecordingUrl ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-3 py-2">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-green-300 text-xs font-medium">Voice recorded!</span>
              </div>
              <button
                type="button"
                onClick={clearVoiceRecording}
                className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/50 hover:bg-white/10 transition"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={isRecording ? stopRecording : () => void startRecording()}
                disabled={recordingStatus === "processing"}
                className={[
                  "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                  isRecording
                    ? "border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/25 animate-pulse"
                    : recordingStatus === "processing"
                    ? "border-white/20 bg-white/5 text-white/40 cursor-wait"
                    : "border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
                ].join(" ")}
              >
                {isRecording ? (
                  <>⏹ Stop</>
                ) : recordingStatus === "processing" ? (
                  <>⏳ Uploading…</>
                ) : (
                  <>🎙️ Record (max 30s)</>
                )}
              </button>
              {isRecording && (
                <span className="text-xs text-red-400/80 animate-pulse">● Recording…</span>
              )}
            </div>
          )}

          {recordingError && (
            <p className="mt-2 text-xs text-red-400">{recordingError}</p>
          )}
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

        {voiceRecordingUrl && (
          <p className="mt-2 text-xs text-purple-400/70 text-center">🎙️ Using your cloned voice</p>
        )}
      </main>
    </div>
  );
}
