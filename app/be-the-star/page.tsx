"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// ─── Story templates ──────────────────────────────────────────────────────────
interface StoryTemplate {
  id: string;
  title: string;
  scene: string;
  situation: string;
  emotion: string;
  action: string;
  line: string;
}

const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "death",
    title: "💀 Death",
    scene: "急诊室冷白灯，背景模糊",
    situation: "医生刚离开，你被告知只剩60秒",
    emotion: "恐惧 + 不敢相信",
    action: "呼吸急促，压低声音",
    line: "…只剩60秒？",
  },
  {
    id: "betrayal",
    title: "🗡️ Betrayal",
    scene: "夜晚房间，灯光昏暗",
    situation: "你刚发现最信任的人在骗你",
    emotion: "压抑愤怒 + 失望",
    action: "靠近镜头，低声",
    line: "…一直在骗我？",
  },
  {
    id: "power",
    title: "👑 Power",
    scene: "高处俯视城市，夜风",
    situation: "所有人刚意识到你才是掌控者",
    emotion: "冷静 + 自信",
    action: "轻微微笑，缓慢开口",
    line: "他们现在才明白。",
  },
];

// Emotion tags per template id — injected into the D-ID text prompt
const EMOTION_TAGS: Record<string, string> = {
  death: "shocked, whispering, breathing fast",
  betrayal: "low voice, angry, controlled",
  power: "calm, confident, slight smile",
};

/** Build a short reactive prompt for D-ID (< 120 chars, no explanatory sentences) */
function buildPrompt(tpl: StoryTemplate): string {
  const tag = EMOTION_TAGS[tpl.id] ?? "natural";
  return `(${tag}) ${tpl.line}`;
}

const DID_POLL_INTERVAL_MS = 3000;
const DID_MAX_POLL_ATTEMPTS = 20; // 20 × 3s = 60s max

// How far into the preview video (0–1) before we cut to paywall
const PREVIEW_CUTOFF_RATIO = 0.60; // 60% — cut early, right after key info

// Stripe Payment Link
// success_url = https://getscriptflow.com/be-the-star/success
// cancel_url  = https://getscriptflow.com/be-the-star
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/REPLACE_ME"; // TODO: replace with real link
const UNLOCK_PARAMS_KEY = "bts_unlock_params";

// Polling interval for OmniHuman status after unlock
const HD_POLL_INTERVAL_MS = 3000;
const HD_MAX_POLL_ATTEMPTS = 200; // 200 × 3s = 10 min max

type Phase = "upload" | "submitting" | "polling" | "result";
type RecordingStatus = "idle" | "recording" | "processing" | "done" | "error";

// Stage drives the HD-unlock flow
type Stage = "idle" | "generating" | "preview" | "paywall" | "processing" | "done";

export default function BeTheStarPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState(STORY_TEMPLATES[0].line);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Stage state for HD unlock flow ────────────────────────────────────────
  const [stage, setStage] = useState<Stage>("idle");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [paywallLoading, setPaywallLoading] = useState(false);

  // ── D-ID quick preview state ───────────────────────────────────────────────
  const [didVideoUrl, setDidVideoUrl] = useState<string | null>(null);
  const [didPhase, setDidPhase] = useState<"idle" | "loading" | "ready">("idle");
  const didPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didPollAttemptsRef = useRef(0);
  const didVideoRef = useRef<HTMLVideoElement>(null);

  // ── HD status polling ──────────────────────────────────────────────────────
  const hdPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hdPollAttemptsRef = useRef(0);
  const hdPollCountRef = useRef(0);
  const [hdPollElapsed, setHdPollElapsed] = useState(0);

  // ── Voice recording state ──────────────────────────────────────────────────
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [voiceRecordingUrl, setVoiceRecordingUrl] = useState<string | null>(null);
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── My Videos state ────────────────────────────────────────────────────────
  const [showMyVideos, setShowMyVideos] = useState(false);
  const [myVideos, setMyVideos] = useState<{ url: string; created_at: string; type: "hd" | "preview"; storagePath?: string; jobId?: string }[]>([]);
  const [myVideosLoading, setMyVideosLoading] = useState(false);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (didPollTimerRef.current) clearTimeout(didPollTimerRef.current);
      if (hdPollTimerRef.current) clearTimeout(hdPollTimerRef.current);
    };
  }, []);

  // ── Beforeunload warning while HD is rendering ─────────────────────────────
  useEffect(() => {
    if (stage !== "processing") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your HD version is still rendering. Don't close - it'll be ready soon!";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stage]);

  // ── Crop image to square (face-centered) using canvas ─────────────────────
  const cropToSquare = useCallback((file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas not supported")); return; }
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 4;
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas toBlob failed"));
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("image load failed")); };
      img.src = objectUrl;
    });
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
      const croppedBlob = await cropToSquare(file);
      const filePath = `be-the-star/${Date.now()}_photo.jpg`;
      const { data, error: uploadErr } = await supabase.storage
        .from("recordings")
        .upload(filePath, croppedBlob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) { setError("Photo upload failed: " + uploadErr.message); return; }

      const url = supabase.storage.from("recordings").getPublicUrl(data.path).data.publicUrl;
      setPhotoUrl(url);
      console.log("[be-the-star] photo uploaded:", url);
    } catch (err) {
      setError("Upload error: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [cropToSquare]);

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
          setVoiceRecordingUrl(pub.publicUrl);
          setRecordingStatus("done");
          console.log("[be-the-star] voice recording uploaded:", pub.publicUrl);
        } catch (e) {
          console.error("[be-the-star] voice upload failed:", e);
          setRecordingError(e instanceof Error ? e.message : "Upload failed");
          setRecordingStatus("error");
        }
      };

      recorder.start(100);

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

  // ── Poll OmniHuman status (after unlock) ──────────────────────────────────
  const scheduleHDPoll = useCallback((tid: string) => {
    hdPollTimerRef.current = setTimeout(async () => {
      hdPollAttemptsRef.current += 1;
      hdPollCountRef.current += 1;
      setHdPollElapsed(hdPollCountRef.current * (HD_POLL_INTERVAL_MS / 1000));

      if (hdPollAttemptsRef.current > HD_MAX_POLL_ATTEMPTS) {
        setError("HD generation timed out after 10 minutes. Please try again.");
        setStage("paywall");
        return;
      }

      try {
        const res = await fetch(`/api/omnihuman-status?taskId=${encodeURIComponent(tid)}`);
        const data = await res.json();
        console.log(`[hd-poll] attempt #${hdPollAttemptsRef.current} status:`, data.status);

        if (data.status === "completed" && data.result_video_url) {
          setVideoUrl(data.result_video_url);
          setStage("done");
          setPhase("result");
          setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 300);
          return;
        }

        if (data.status === "failed") {
          setError("HD generation failed. Please try again.");
          setStage("paywall");
          return;
        }

        // Still pending/processing — keep polling
        scheduleHDPoll(tid);
      } catch (err) {
        console.warn("[hd-poll] network error:", err);
        scheduleHDPoll(tid);
      }
    }, HD_POLL_INTERVAL_MS);
  }, []);

  // ── Submit job (D-ID preview only — no auto OmniHuman) ────────────────────
  const handleGenerate = useCallback(async () => {
    if (!photoUrl) { setError("Please upload a photo first."); return; }

    // 📊 埋点
    console.log("[analytics] generate_click");

    setPhase("submitting");
    setStage("generating");
    setError(null);
    setStep("Generating your preview...");
    setDidVideoUrl(null);
    setDidPhase("loading");
    didPollAttemptsRef.current = 0;
    setGeneratedAudioUrl(null);

    // Build full prompt from selected template
    const selectedTpl = STORY_TEMPLATES.find((t) => t.line === firstLine) ?? STORY_TEMPLATES[0];
    const fullPrompt = buildPrompt(selectedTpl);

    // D-ID quick preview only — OmniHuman HD is NOT triggered here
    fetch("/api/did-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: photoUrl, text: fullPrompt, voiceId: clonedVoiceId ?? undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.videoUrl) {
          console.log("[did-preview] videoUrl:", d.videoUrl);
          setDidVideoUrl(d.videoUrl);
          setDidPhase("ready");
          // Move to preview stage — paywall will show after cutoff
          setStage("preview");
          setPhase("polling");
          // 📊 埋点
          console.log("[analytics] paywall_view");
          setTimeout(() => { didVideoRef.current?.play().catch(() => {}); }, 300);
        } else {
          console.warn("[did-preview] no videoUrl returned:", d);
          setDidPhase("idle");
          setStage("idle");
          setPhase("upload");
          setError("Preview generation failed. Please try again.");
        }
      })
      .catch((e) => {
        console.warn("[did-preview] request failed:", e);
        setDidPhase("idle");
        setStage("idle");
        setPhase("upload");
        setError("Preview generation failed. Please try again.");
      });
  }, [photoUrl, firstLine, clonedVoiceId]);

  // ── Unlock HD (called when user clicks the paywall button) ────────────────
  const handleUnlockHD = useCallback(async () => {
    if (!photoUrl) return;
    setStage("processing");
    setError(null);
    hdPollAttemptsRef.current = 0;
    hdPollCountRef.current = 0;
    setHdPollElapsed(0);

    try {
      const res = await fetch("/api/unlock-hd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: photoUrl,
          audioUrl: generatedAudioUrl ?? undefined,
          firstLine,
          voiceRecordingUrl: voiceRecordingUrl ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.taskId) {
        throw new Error(data.error ?? "Unlock HD failed");
      }

      console.log("[unlock-hd] task submitted, taskId:", data.taskId);
      setTaskId(data.taskId);
      if (data.audioUrl) setGeneratedAudioUrl(data.audioUrl);
      setStep("Animating your character in HD...");

      // Start polling /api/omnihuman-status
      scheduleHDPoll(data.taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock HD failed");
      setStage("paywall"); // revert to paywall so user can retry
    }
  }, [photoUrl, firstLine, voiceRecordingUrl, generatedAudioUrl, scheduleHDPoll]);

  // ── Load My Videos ─────────────────────────────────────────────────────────
  const loadMyVideos = useCallback(async () => {
    setMyVideosLoading(true);
    try {
      const supabase = createClient();

      const { data: allJobs } = await supabase
        .from("omnihuman_jobs")
        .select("id, result_video_url, created_at")
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (allJobs && allJobs.length > 10) {
        const toDelete = allJobs.slice(10);
        for (const job of toDelete) {
          await supabase.from("omnihuman_jobs").delete().eq("id", job.id);
        }
      }

      const jobs = (allJobs ?? []).slice(0, 10);

      const { data: allStorageFiles } = await supabase.storage
        .from("recordings")
        .list("did-preview", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      const mp4Files = (allStorageFiles ?? []).filter((f) => f.name.endsWith(".mp4"));

      if (mp4Files.length > 10) {
        const toDelete = mp4Files.slice(10);
        await supabase.storage
          .from("recordings")
          .remove(toDelete.map((f) => `did-preview/${f.name}`));
      }

      const storageFiles = mp4Files.slice(0, 10);

      const hdVideos = jobs
        .filter((j) => j.result_video_url)
        .map((j) => ({
          url: j.result_video_url as string,
          created_at: j.created_at as string,
          type: "hd" as const,
          jobId: j.id as string,
        }));

      const previewVideos = storageFiles.map((f) => ({
        url: supabase.storage.from("recordings").getPublicUrl(`did-preview/${f.name}`).data.publicUrl,
        created_at: f.created_at ?? "",
        type: "preview" as const,
        storagePath: `did-preview/${f.name}`,
      }));

      const all = [...hdVideos, ...previewVideos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setMyVideos(all);
    } catch (e) {
      console.error("[my-videos] load error:", e);
    } finally {
      setMyVideosLoading(false);
    }
  }, []);

  const handleOpenMyVideos = useCallback(async () => {
    setShowMyVideos(true);
    await loadMyVideos();
  }, [loadMyVideos]);

  const handleDeleteVideo = useCallback(async (v: typeof myVideos[0]) => {
    try {
      const supabase = createClient();
      if (v.type === "preview" && v.storagePath) {
        await supabase.storage.from("recordings").remove([v.storagePath]);
      } else if (v.type === "hd" && v.jobId) {
        await supabase.from("omnihuman_jobs").delete().eq("id", v.jobId);
      }
      await loadMyVideos();
    } catch (e) {
      console.error("[my-videos] delete error:", e);
    }
  }, [loadMyVideos, myVideos]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (didPollTimerRef.current) clearTimeout(didPollTimerRef.current);
    if (hdPollTimerRef.current) clearTimeout(hdPollTimerRef.current);
    setPhase("upload");
    setStage("idle");
    setPhotoUrl(null);
    setPhotoPreview(null);
    setVideoUrl(null);
    setTaskId(null);
    setError(null);
    setStep("");
    setDidVideoUrl(null);
    setDidPhase("idle");
    didPollAttemptsRef.current = 0;
    hdPollAttemptsRef.current = 0;
    hdPollCountRef.current = 0;
    setHdPollElapsed(0);
    setGeneratedAudioUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: SUBMITTING (waiting for D-ID)
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "submitting") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full border-2 border-yellow-500/30 border-t-yellow-400 animate-spin" />
          <p className="text-white/70 text-sm tracking-wide text-center">
            Generating your preview…
          </p>
          <p className="text-yellow-400/60 text-xs font-semibold">⚡ Quick Preview — coming in ~30s</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: POLLING — D-ID preview ready
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === "polling" && didPhase === "ready" && didVideoUrl) {
    return (
      <div className="fixed inset-0 bg-black">
        {/* ── Video (always rendered, paused when paywall hits) ── */}
        <video
          ref={didVideoRef}
          src={didVideoUrl}
          playsInline
          autoPlay
          muted={false}
          className="absolute inset-0 w-full h-full object-cover"
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            if (vid.duration > 0 && vid.currentTime / vid.duration >= PREVIEW_CUTOFF_RATIO) {
              vid.pause();
              setStage("paywall");
            }
          }}
        />

        {/* ── Preview label (only while playing) ── */}
        {stage === "preview" && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-black/60 border border-yellow-500/40 px-3 py-1.5 backdrop-blur">
            <span className="text-yellow-400 text-xs font-bold">⚡ Quick Preview</span>
          </div>
        )}

        {/* ── Full-screen paywall overlay (after cutoff) ── */}
        {stage === "paywall" && (
          <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center px-6 gap-6">
            <div className="flex flex-col items-center gap-2">
              <p className="text-4xl">🎬</p>
              <p className="text-white font-extrabold text-2xl text-center leading-tight">
                What happens next?
              </p>
              <p className="text-white/60 text-sm text-center max-w-xs">
                Continue your story in this world
              </p>
            </div>

            {/* Benefits */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {["🎬 Full HD · no watermark", "⬇️ Download to your device", "🎙️ Your voice · your face"].map((b) => (
                <div key={b} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
                  <p className="text-white/80 text-sm">{b}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="w-full max-w-xs flex flex-col gap-3">
              <button
                type="button"
                disabled={paywallLoading}
                onClick={async () => {
                  if (paywallLoading) return;
                  console.log("[analytics] paywall_click", { stage: "paywall" });
                  setPaywallLoading(true);
                  await handleUnlockHD();
                  setPaywallLoading(false);
                }}
                className={[
                  "w-full py-4 rounded-2xl font-extrabold text-lg transition shadow-2xl",
                  !paywallLoading
                    ? "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/40 cursor-pointer"
                    : "bg-white/10 text-white/30 cursor-not-allowed",
                ].join(" ")}
              >
                {paywallLoading ? "⏳ Processing..." : "🎬 Continue My Story ($4.99)"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={paywallLoading}
                className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs hover:bg-white/10 transition disabled:opacity-40"
              >
                Start Over
              </button>
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
          </div>
        )}

        {/* ── Processing overlay (HD rendering) ── */}
        {stage === "processing" && (
          <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center px-6 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
            <p className="text-white font-bold text-base text-center">Generating your HD version…</p>
            <p className="text-white/40 text-xs text-center">This takes ~4 minutes. Don&apos;t close this tab!</p>
            {hdPollElapsed > 0 && (
              <p className="text-white/30 text-xs">{hdPollElapsed}s elapsed · checking every 3s</p>
            )}
            {taskId && (
              <p className="text-white/20 text-xs font-mono">task: {taskId.slice(0, 16)}…</p>
            )}
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: RESULT (OmniHuman HD ready)
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

        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            🎬 HD Version Ready
          </div>
        </div>

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
        <div className="mb-8 text-center relative w-full">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-purple-400">ScriptFlow</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Be the Star 🌟</h1>
          <p className="mt-2 text-white/50 text-sm">Upload your photo and hear your character speak</p>
          <button
            type="button"
            onClick={() => void handleOpenMyVideos()}
            className="absolute top-0 right-0 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white/80 transition"
          >
            🎬 My Videos
          </button>
        </div>

        {/* ── My Videos modal ──────────────────────────────────────────────── */}
        {showMyVideos && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <p className="text-white font-bold text-base">🎬 My Videos</p>
              <button
                type="button"
                onClick={() => setShowMyVideos(false)}
                className="text-white/40 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {myVideosLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
                  <p className="text-white/40 text-xs">Loading your videos…</p>
                </div>
              ) : myVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2">
                  <p className="text-white/40 text-sm">No videos yet</p>
                  <p className="text-white/20 text-xs">Generate your first character above!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {myVideos.map((v, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
                        <span className="text-xs font-semibold">
                          {v.type === "hd" ? "🎬 HD Version" : "⚡ Quick Preview"}
                        </span>
                        <span className="text-white/30 text-[10px]">
                          {v.created_at ? new Date(v.created_at).toLocaleDateString() : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteVideo(v)}
                          className="ml-auto text-white/30 hover:text-red-400 text-sm transition"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                      <video
                        src={v.url}
                        playsInline
                        controls
                        className="w-full aspect-video object-cover"
                      />
                      <div className="px-3 py-2">
                        <a
                          href={v.url}
                          download={`character-${i + 1}.mp4`}
                          className="block w-full text-center py-2 rounded-xl bg-purple-600/80 text-white text-xs font-semibold hover:bg-purple-500 transition"
                        >
                          ⬇️ Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Choose your story ─────────────────────────────────────────────── */}
        <div className="w-full mb-6">
          <p className="text-sm font-semibold text-white mb-3">Choose your story</p>
          <div className="flex flex-col gap-3">
            {STORY_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setFirstLine(tpl.line)}
                className={[
                  "w-full text-left px-4 py-3 rounded-2xl border transition-all",
                  firstLine === tpl.line
                    ? "border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8",
                ].join(" ")}
              >
                <p className={["text-sm font-bold mb-0.5", firstLine === tpl.line ? "text-purple-300" : "text-white/70"].join(" ")}>
                  {tpl.title}
                </p>
                <p className="text-white/50 text-xs leading-relaxed">&ldquo;{tpl.line}&rdquo;</p>
              </button>
            ))}
          </div>
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
