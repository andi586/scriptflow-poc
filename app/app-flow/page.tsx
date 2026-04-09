"use client";

import { useState, useRef, useEffect, useCallback } from "react";
// import { PRICING } from "@/lib/generation-tiers"; // Hidden until Stripe is activated

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractFirstFrame(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    video.onloadeddata = () => { video.currentTime = 0.1; };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 854;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error("no ctx")); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("video error")); };
    video.load();
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_SECONDS = 10;
const MAX_SECONDS = 60;

const CHAOS_SPARKS = [
  { emoji: "🌊", text: "A surfer discovers a message in a bottle that changes everything" },
  { emoji: "🤖", text: "An AI falls in love with its creator's morning coffee ritual" },
  { emoji: "🌙", text: "Two strangers meet on the last train and share their biggest secret" },
];

const SUBTITLES = [
  { start: 0,  end: 10, text: "Show your face..." },
  { start: 10, end: 20, text: "Now show your world..." },
  { start: 20, end: 35, text: "Keep going..." },
  { start: 35, end: 50, text: "Almost there..." },
  { start: 50, end: 60, text: "Wrapping up..." },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "input" | "camera_prompt" | "record" | "processing" | "result";

// ─── Component ────────────────────────────────────────────────────────────────
export default function AppFlowPage() {
  const [phase, setPhase]           = useState<Phase>("input");
  const [storyText, setStoryText]   = useState("");
  const [isListening, setIsListening] = useState(false);

  // record state
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds]         = useState(0);
  const [subtitle, setSubtitle]       = useState("");
  const [tooShort, setTooShort]       = useState(false);
  const [doneSeconds, setDoneSeconds] = useState<number | null>(null);

  // result state
  const [videoUrl, setVideoUrl]   = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [step, setStep]           = useState("");
  const [error, setError]         = useState<string | null>(null);

  // refs
  const previewRef    = useRef<HTMLVideoElement | null>(null);
  const resultRef     = useRef<HTMLVideoElement | null>(null);
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const streamRef     = useRef<MediaStream | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const secondsRef    = useRef(0);

  // ── subtitle sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) { setSubtitle(""); return; }
    setSubtitle(SUBTITLES.find(s => seconds >= s.start && seconds < s.end)?.text ?? "");
  }, [isRecording, seconds]);

  // ── open camera only when entering record phase ────────────────────────────
  useEffect(() => {
    if (phase !== "record") return;
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (previewRef.current) previewRef.current.srcObject = stream;
      })
      .catch(() => {
        if (alive) setError("Camera access denied. Please allow camera and reload.");
      });
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [phase]);

  // ── auto-play result video ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "result" || !videoUrl) return;
    const t = setTimeout(() => {
      resultRef.current?.play().catch(() => setVideoEnded(true));
    }, 100);
    return () => clearTimeout(t);
  }, [phase, videoUrl]);

  // ── voice recognition ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setError("Speech recognition not supported in this browser."); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setStoryText(t);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!streamRef.current) { setError("Camera not ready."); return; }
    setError(null);
    setTooShort(false);
    setDoneSeconds(null);
    chunksRef.current = [];
    setSeconds(0);
    secondsRef.current = 0;

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";

    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const finalSec = secondsRef.current;
      setIsRecording(false);

      if (finalSec < MIN_SECONDS) {
        setTooShort(true);
        return;
      }

      const blob = new Blob(chunksRef.current, { type: mime });
      setDoneSeconds(finalSec);
      setTimeout(() => void processRecording(blob), 1500);
    };

    recorder.start(100);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(s => s + 1);
    }, 1000);

    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_SECONDS * 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  // ── helper: upload blob to Supabase Storage via /api/upload ───────────────
  const uploadBlob = useCallback(async (blob: Blob, filename: string): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append("file", blob, filename);
      form.append("bucket", "recordings");
      form.append("folder", "tmp");
      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.url) {
        console.warn("[app-flow] upload failed:", data.error ?? res.status);
        return null;
      }
      console.log("[app-flow] uploaded", filename, "→", data.url);
      return data.url as string;
    } catch (e) {
      console.warn("[app-flow] upload error:", e);
      return null;
    }
  }, []);

  // ── process recording ──────────────────────────────────────────────────────
  const processRecording = useCallback(async (blob: Blob) => {
    setPhase("processing");
    setStep("Uploading your recording...");
    try {
      // Step 1: Upload audio blob → Supabase Storage → HTTPS URL
      const audioMime = blob.type || "video/webm";
      const audioExt  = audioMime.includes("mp4") ? "mp4" : "webm";
      const audioBlob = new Blob([blob], { type: audioMime });
      const audioUrl  = await uploadBlob(audioBlob, `audio_${Date.now()}.${audioExt}`);
      console.log("[app-flow] audioUrl:", audioUrl);

      // Step 2: Extract first frame → upload image → HTTPS URL
      setStep("Analyzing your video...");
      let imageUrl: string | null = null;
      try {
        const frameDataUrl = await extractFirstFrame(blob);
        console.log("[app-flow] extractFirstFrame OK, length:", frameDataUrl.length);
        const res     = await fetch(frameDataUrl);
        const imgBlob = await res.blob();
        imageUrl = await uploadBlob(imgBlob, `frame_${Date.now()}.jpg`);
        console.log("[app-flow] imageUrl:", imageUrl);
      } catch (e) {
        console.warn("[app-flow] frame extraction/upload failed:", e);
      }

      // Step 3: Start pipeline — create project in DB (before voice clone so we have projectId)
      setStep("Starting pipeline...");
      let projectId: string | null = null;
      try {
        const pipeRes  = await fetch("/api/pipeline/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: storyText || "User recorded video",
            imageUrl,
            audioUrl,
            isStarMode: true,
          }),
        });
        const pipeData = await pipeRes.json();
        projectId = pipeData.projectId ?? null;
        console.log("[pipeline] starting for project:", projectId);
        if (!pipeData.success) {
          console.warn("[app-flow] pipeline/start non-success:", pipeData.error);
        }
      } catch (e) {
        console.warn("[app-flow] pipeline/start error (non-fatal):", e);
      }

      // Step 4: Voice clone — send audio + projectId as FormData (no manual Content-Type)
      let voiceId: string | null = null;
      try {
        const vcForm = new FormData();
        vcForm.append("audio", blob, "recording.webm");
        if (projectId) vcForm.append("projectId", projectId);
        const vcRes  = await fetch("/api/voice-clone", { method: "POST", body: vcForm });
        const vcData = await vcRes.json();
        voiceId = vcData.voice_id ?? null;
        console.log("[app-flow] voice_id:", voiceId ?? "none");
      } catch (e) {
        console.warn("[app-flow] voice-clone error (non-fatal):", e);
      }

      // Step 5: Call OmniHuman with real HTTPS URLs
      setStep("Generating your movie...");
      let generatedUrl: string | null = null;
      if (imageUrl && audioUrl) {
        try {
          console.log("[app-flow] calling omni-human, projectId:", projectId);
          const ohRes  = await fetch("/api/omni-human", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl,
              audioUrl,
              prompt: storyText || "person speaks naturally cinematic",
              projectId,
            }),
          });
          const ohData = await ohRes.json();
          console.log("[app-flow] omni-human response:", ohData.success, ohData.videoUrl ?? ohData.error);
          if (ohData.success && ohData.videoUrl) generatedUrl = ohData.videoUrl;
        } catch (e) {
          console.warn("[app-flow] omni-human error, falling back to local blob:", e);
        }
      } else {
        console.warn("[app-flow] skipping omni-human: missing imageUrl or audioUrl", { imageUrl, audioUrl });
      }

      setStep("Almost done...");
      setVideoUrl(generatedUrl ?? URL.createObjectURL(blob));
      setVideoEnded(false);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setPhase("record");
    }
  }, [storyText, uploadBlob]);

  // ── skip camera (AI actor) ─────────────────────────────────────────────────
  const skipCamera = useCallback(() => {
    setPhase("processing");
    setStep("Generating your movie...");
    fetch("/api/narrative/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: storyText, tier: "preview", maxShots: 3 }),
    })
      .then(r => r.json())
      .then(() => { setVideoUrl(null); setVideoEnded(true); setPhase("result"); })
      .catch(() => { setVideoEnded(true); setPhase("result"); });
  }, [storyText]);

  // ── make another ───────────────────────────────────────────────────────────
  const makeAnother = useCallback(() => {
    if (videoUrl?.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoEnded(false);
    setSeconds(0);
    setSubtitle("");
    setError(null);
    setStep("");
    setDoneSeconds(null);
    setTooShort(false);
    setStoryText("");
    setPhase("input");
  }, [videoUrl]);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: INPUT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "input") {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(700px_circle_at_50%_20%,rgba(139,92,246,0.18),transparent_60%)]" />

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-400">ScriptFlow</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Your Story. Your Movie. 🎬</h1>
          </div>

          {/* Story textarea + mic */}
          <div className="w-full mb-6">
            <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
              <textarea
                value={storyText}
                onChange={e => setStoryText(e.target.value)}
                rows={5}
                placeholder="Tell your story..."
                className="w-full resize-none bg-transparent px-5 pt-5 pb-14 text-base text-white outline-none placeholder:text-white/30"
              />
              {/* Mic button — bottom-right */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop" : "Speak your story"}
                className={[
                  "absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all",
                  isListening
                    ? "bg-red-500 shadow-lg shadow-red-500/40 animate-pulse"
                    : "bg-white/10 hover:bg-white/20",
                ].join(" ")}
              >
                🎤
              </button>
              {isListening && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400">Listening…</span>
                </div>
              )}
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-red-400 text-center">{error}</p>}

          {/* CTA */}
          <button
            type="button"
            onClick={() => {
              console.log("[app-flow] Create My Movie clicked, storyText:", JSON.stringify(storyText));
              setError(null);
              setPhase("camera_prompt");
            }}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-base hover:bg-purple-500 active:bg-purple-700 transition-all shadow-lg shadow-purple-500/30 mb-8 cursor-pointer select-none"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            ✨ Create My Movie
          </button>

          {/* Chaos Sparks */}
          <div className="w-full">
            <p className="mb-3 text-center text-xs uppercase tracking-widest text-white/30">⚡ Chaos Sparks</p>
            <div className="flex flex-col gap-2">
              {CHAOS_SPARKS.map((spark, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStoryText(spark.text)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/40 transition-all group"
                >
                  <span className="mr-2">{spark.emoji}</span>
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{spark.text}</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: CAMERA PROMPT
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "camera_prompt") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 gap-8">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(600px_circle_at_50%_40%,rgba(139,92,246,0.15),transparent_60%)]" />

        <div className="text-center">
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-2xl font-bold text-white mb-2">Want to star in your movie?</h2>
          <p className="text-white/50 text-sm max-w-xs">
            Record a short video of yourself and we&apos;ll put you in the film
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => { setError(null); setTooShort(false); setDoneSeconds(null); setPhase("record"); }}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-base hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
          >
            📷 Add Yourself
          </button>

          <button
            type="button"
            onClick={skipCamera}
            className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base hover:bg-white/15 transition-all"
          >
            Skip — Use AI Actor
          </button>

          <button
            type="button"
            onClick={() => setPhase("input")}
            className="w-full py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RECORD
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "record") {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        <video
          ref={previewRef}
          autoPlay muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 flex flex-col items-center justify-between h-full w-full px-6 py-16">
          {/* Top */}
          <div className="text-center">
            {!isRecording && !tooShort && !doneSeconds && (
              <p className="text-white text-2xl font-light tracking-widest opacity-90 drop-shadow">
                Tell your story.
              </p>
            )}
          </div>

          {/* Middle */}
          <div className="flex-1 flex items-center justify-center">
            {/* Too short warning */}
            {tooShort && (
              <div className="bg-black/70 rounded-2xl px-6 py-5 text-center max-w-xs">
                <p className="text-yellow-400 text-base font-semibold leading-snug">
                  Too short! Please record<br />at least {MIN_SECONDS} seconds. 🎬
                </p>
                <button
                  type="button"
                  onClick={() => setTooShort(false)}
                  className="mt-3 text-white/60 text-sm hover:text-white/80"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Success */}
            {doneSeconds !== null && !tooShort && (
              <div className="bg-black/60 rounded-2xl px-6 py-4 text-center">
                <p className="text-white text-lg font-semibold">
                  Great! {doneSeconds} seconds recorded ✅
                </p>
              </div>
            )}

            {/* Subtitle during recording */}
            {isRecording && subtitle && !tooShort && !doneSeconds && (
              <p className="text-white text-xl font-medium text-center px-8 drop-shadow-lg animate-pulse">
                {subtitle}
              </p>
            )}
          </div>

          {/* Bottom */}
          <div className="flex flex-col items-center gap-4">
            {/* Timer */}
            {isRecording && (
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-sm font-mono tabular-nums">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                  {" / "}
                  {String(Math.floor(MAX_SECONDS / 60)).padStart(2, "0")}:{String(MAX_SECONDS % 60).padStart(2, "0")}
                </span>
                {seconds < MIN_SECONDS && (
                  <span className="text-yellow-400 text-xs">min {MIN_SECONDS}s</span>
                )}
              </div>
            )}

            {/* Record / Stop button — hidden while showing success */}
            {!doneSeconds && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : () => void startRecording()}
                className={[
                  "flex items-center gap-3 px-8 py-4 rounded-full text-base font-semibold transition-all",
                  isRecording
                    ? "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-500/40"
                    : "bg-white text-black hover:bg-white/90 shadow-lg shadow-white/20",
                ].join(" ")}
              >
                {isRecording
                  ? <><span className="w-3 h-3 rounded-sm bg-white" /> Stop</>
                  : <><span className="w-3 h-3 rounded-full bg-red-500" /> Record</>
                }
              </button>
            )}

            {/* Camera error */}
            {error && !tooShort && (
              <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>
            )}

            {/* Back link */}
            {!isRecording && !doneSeconds && !tooShort && (
              <button
                type="button"
                onClick={() => setPhase("camera_prompt")}
                className="text-white/40 text-sm hover:text-white/60 transition-colors"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: PROCESSING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "processing") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-white/70 text-sm tracking-wide">{step || "Creating your movie…"}</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black">
      {videoUrl && (
        <video
          ref={resultRef}
          src={videoUrl}
          playsInline autoPlay controls
          className="absolute inset-0 w-full h-full object-cover"
          onEnded={() => setVideoEnded(true)}
        />
      )}

      {/* Overlay shown when video ended or no video */}
      {(videoEnded || !videoUrl) && <div className="absolute inset-0 bg-black/75" />}

      {(videoEnded || !videoUrl) && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 gap-6">
          <p className="text-white text-2xl font-semibold text-center tracking-wide">
            Your movie is ready. 🎬
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {/* ── Download button (always visible) ── */}
            {videoUrl && (
              <a
                href={videoUrl}
                download="my-movie.webm"
                className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-base text-center hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/30"
              >
                ⬇️ Download My Movie
              </a>
            )}

            {/* ── Paywall buttons — HIDDEN until Stripe is activated ──
            <button
              type="button"
              className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold text-base hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/30"
              onClick={() => alert(`Checkout: $${PRICING.fullMovie}`)}
            >
              🎬 Unlock Full Movie — ${PRICING.fullMovie}
            </button>
            <button
              type="button"
              className="w-full py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-base hover:bg-white/15 transition-all"
              onClick={() => alert(`Subscribe: $${PRICING.unlimited}/mo`)}
            >
              ∞ Unlimited — ${PRICING.unlimited}/mo
            </button>
            ── END Paywall ── */}

            <button
              type="button"
              className="w-full py-3 text-white/50 text-sm hover:text-white/70 transition-colors"
              onClick={makeAnother}
            >
              Make Another
            </button>
          </div>
        </div>
      )}

      {/* Replay + Download overlay while video is playing */}
      {videoUrl && !videoEnded && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 z-10">
          <button
            type="button"
            className="px-6 py-2 rounded-full bg-black/40 border border-white/20 text-white/70 text-sm hover:bg-black/60 transition-all"
            onClick={() => {
              if (resultRef.current) { resultRef.current.currentTime = 0; resultRef.current.play().catch(() => {}); }
            }}
          >
            ↺ Replay
          </button>
          <a
            href={videoUrl}
            download="my-movie.webm"
            className="px-6 py-2 rounded-full bg-purple-600/80 border border-purple-500/40 text-white text-sm hover:bg-purple-600 transition-all"
          >
            ⬇️ Download
          </a>
        </div>
      )}
    </div>
  );
}
