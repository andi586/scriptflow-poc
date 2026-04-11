"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const UNLOCK_PARAMS_KEY = "bts_unlock_params";
const UNLOCK_SESSION_KEY = "bts_unlock_session"; // sessionStorage: prevents replay within same tab session
const LAST_TASK_KEY = "bts_last_task_id";

// Poll up to 8 minutes (160 × 3s)
const HD_POLL_INTERVAL_MS = 3000;
const HD_MAX_POLL_ATTEMPTS = 160;

type Stage = "loading" | "processing" | "done" | "error" | "already_processed";

interface UnlockParams {
  imageUrl: string;
  audioUrl?: string | null;
  firstLine: string;
}

export default function BeTheStarSuccessPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [hdPollElapsed, setHdPollElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [firstLine, setFirstLine] = useState<string>("");
  const [timedOut, setTimedOut] = useState(false);

  const hdPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hdPollAttemptsRef = useRef(0);
  const hdPollCountRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStarted = useRef(false);

  // ── Poll OmniHuman status ──────────────────────────────────────────────────
  const scheduleHDPoll = (tid: string) => {
    hdPollTimerRef.current = setTimeout(async () => {
      hdPollAttemptsRef.current += 1;
      hdPollCountRef.current += 1;
      setHdPollElapsed(hdPollCountRef.current * (HD_POLL_INTERVAL_MS / 1000));

      if (hdPollAttemptsRef.current > HD_MAX_POLL_ATTEMPTS) {
        // 📊 埋点
        console.log("[analytics] hd_poll_timeout", { taskId: tid, elapsed: hdPollCountRef.current * 3 });
        setTimedOut(true);
        return; // Don't set error — show "continue waiting" UI instead
      }

      try {
        const res = await fetch(`/api/omnihuman-status?taskId=${encodeURIComponent(tid)}`);
        const data = await res.json();
        console.log(`[success/hd-poll] attempt #${hdPollAttemptsRef.current} status:`, data.status);

        if (data.status === "completed" && data.result_video_url) {
          setVideoUrl(data.result_video_url);
          setStage("done");
          // 📊 埋点
          console.log("[analytics] hd_completed", { taskId: tid });
          setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 300);
          return;
        }

        if (data.status === "failed") {
          setError("HD generation failed. Please contact support.");
          setStage("error");
          return;
        }

        // Still pending/processing — keep polling
        scheduleHDPoll(tid);
      } catch (err) {
        console.warn("[success/hd-poll] network error:", err);
        scheduleHDPoll(tid);
      }
    }, HD_POLL_INTERVAL_MS);
  };

  // ── Resume polling for an existing taskId (after timeout "continue waiting") ──
  const resumePolling = () => {
    if (!taskId) return;
    setTimedOut(false);
    hdPollAttemptsRef.current = 0;
    scheduleHDPoll(taskId);
  };

  // ── On mount: read localStorage params and call /api/unlock-hd ────────────
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // ── Anti-replay: check sessionStorage ─────────────────────────────────
    const sessionFlag = sessionStorage.getItem(UNLOCK_SESSION_KEY);
    if (sessionFlag) {
      // Already processed in this browser session — check if we have a taskId to resume
      const savedTaskId = localStorage.getItem(LAST_TASK_KEY);
      if (savedTaskId) {
        console.log("[success] session replay detected — resuming poll for taskId:", savedTaskId);
        setTaskId(savedTaskId);
        setStage("processing");
        hdPollAttemptsRef.current = 0;
        hdPollCountRef.current = 0;
        scheduleHDPoll(savedTaskId);
      } else {
        setStage("already_processed");
      }
      return;
    }

    // ── Read localStorage params ───────────────────────────────────────────
    const raw = localStorage.getItem(UNLOCK_PARAMS_KEY);
    if (!raw) {
      setStage("already_processed");
      return;
    }

    let params: UnlockParams;
    try {
      params = JSON.parse(raw) as UnlockParams;
    } catch {
      setError("Invalid unlock parameters. Please go back and try again.");
      setStage("error");
      return;
    }

    if (!params.imageUrl || !params.firstLine) {
      setError("Missing required parameters. Please go back and try again.");
      setStage("error");
      return;
    }

    setFirstLine(params.firstLine);
    setStage("processing");

    // Clear localStorage so it can't be replayed on next page load
    localStorage.removeItem(UNLOCK_PARAMS_KEY);
    // Mark session as processed
    sessionStorage.setItem(UNLOCK_SESSION_KEY, "1");

    // 📊 埋点
    console.log("[analytics] payment_success_landed", { firstLine: params.firstLine.slice(0, 30) });

    // ── Call /api/unlock-hd ────────────────────────────────────────────────
    fetch("/api/unlock-hd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: params.imageUrl,
        audioUrl: params.audioUrl ?? undefined,
        firstLine: params.firstLine,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.taskId) {
          throw new Error(data.error ?? "Unlock HD failed");
        }
        console.log("[success] unlock-hd taskId:", data.taskId, "idempotent:", data.idempotent ?? false);
        setTaskId(data.taskId);
        // Persist taskId for "view my video" recovery
        localStorage.setItem(LAST_TASK_KEY, data.taskId);

        // If already completed (idempotent hit with result), skip polling
        if (data.result_video_url) {
          setVideoUrl(data.result_video_url);
          setStage("done");
          // 📊 埋点
          console.log("[analytics] hd_completed_idempotent", { taskId: data.taskId });
          return;
        }

        hdPollAttemptsRef.current = 0;
        hdPollCountRef.current = 0;
        scheduleHDPoll(data.taskId);
      })
      .catch((err) => {
        console.error("[success] unlock-hd error:", err);
        setError(err instanceof Error ? err.message : "Unlock HD failed");
        setStage("error");
      });

    return () => {
      if (hdPollTimerRef.current) clearTimeout(hdPollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Beforeunload warning while processing ─────────────────────────────────
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

  // ════════════════════════════════════════════════════════════════════════════
  // STAGE: LOADING
  // ════════════════════════════════════════════════════════════════════════════
  if (stage === "loading") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        <p className="text-white/60 text-sm">Verifying payment…</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STAGE: ALREADY PROCESSED (no params in localStorage)
  // ════════════════════════════════════════════════════════════════════════════
  if (stage === "already_processed") {
    const savedTaskId = typeof window !== "undefined" ? localStorage.getItem(LAST_TASK_KEY) : null;
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(700px_circle_at_50%_20%,rgba(139,92,246,0.18),transparent_60%)]" />
        <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-black/90 backdrop-blur p-6 flex flex-col items-center gap-4">
          <div className="text-4xl">🎬</div>
          <p className="text-white font-bold text-base text-center">Order already processed</p>
          <p className="text-white/50 text-xs text-center">
            Your HD video is being generated. Check &ldquo;My Videos&rdquo; on the main page.
          </p>
          {savedTaskId && (
            <button
              type="button"
              onClick={() => {
                setTaskId(savedTaskId);
                setStage("processing");
                hdPollAttemptsRef.current = 0;
                hdPollCountRef.current = 0;
                scheduleHDPoll(savedTaskId);
              }}
              className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 transition"
            >
              ⏳ Check Status
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/be-the-star")}
            className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 transition"
          >
            ← Back to Be the Star
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STAGE: PROCESSING (HD rendering) — with timeout UI
  // ════════════════════════════════════════════════════════════════════════════
  if (stage === "processing") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(700px_circle_at_50%_20%,rgba(139,92,246,0.18),transparent_60%)]" />

        {/* Success badge */}
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-2xl">
            ✅
          </div>
          <p className="text-green-400 text-sm font-semibold">Payment successful!</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-purple-500/40 bg-black/90 backdrop-blur p-6 flex flex-col items-center gap-4 shadow-2xl shadow-purple-500/20">
          {timedOut ? (
            <>
              <div className="text-3xl">⏰</div>
              <p className="text-white font-bold text-sm text-center">Still rendering…</p>
              <p className="text-white/40 text-xs text-center">
                HD generation can take up to 8 minutes. Your video is still being processed.
              </p>
              <button
                type="button"
                onClick={resumePolling}
                className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 transition"
              >
                ⏳ Continue Waiting
              </button>
              <button
                type="button"
                onClick={() => router.push("/be-the-star")}
                className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 transition"
              >
                Check Later in My Videos
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
              <p className="text-white font-bold text-base text-center">Generating your HD version…</p>
              <p className="text-white/40 text-xs text-center">
                This takes ~4 minutes. Don&apos;t close this tab!
              </p>
              {hdPollElapsed > 0 && (
                <p className="text-white/30 text-xs">{hdPollElapsed}s elapsed · checking every 3s</p>
              )}
              {taskId && (
                <p className="text-white/20 text-xs font-mono">task: {taskId.slice(0, 16)}…</p>
              )}
            </>
          )}

          {/* Progress steps */}
          <div className="w-full border-t border-white/10 pt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400">✅</span>
              <span className="text-white/70">Payment verified</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {timedOut ? (
                <span className="text-orange-400">⏰</span>
              ) : (
                <span className="text-yellow-400 animate-pulse">⏳</span>
              )}
              <span className="text-white/70">HD video rendering</span>
              <span className="ml-auto text-yellow-400/70 text-[10px]">
                {timedOut ? "still processing…" : "in progress…"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs opacity-40">
              <span>🎬</span>
              <span className="text-white/70">Ready to download</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STAGE: DONE (HD ready)
  // ════════════════════════════════════════════════════════════════════════════
  if (stage === "done" && videoUrl) {
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

        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            🎬 HD Version Ready
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center gap-4 z-10">
          <p className="text-white text-xl font-bold text-center drop-shadow-lg">
            Meet your character. 🎬
          </p>
          {firstLine && (
            <p className="text-white/60 text-sm text-center max-w-xs">
              &ldquo;{firstLine}&rdquo;
            </p>
          )}
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
              onClick={() => router.push("/be-the-star")}
              className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/15 transition"
            >
              Make Another
            </button>
          </div>
          {/* View My Videos shortcut */}
          <button
            type="button"
            onClick={() => router.push("/be-the-star")}
            className="text-white/30 text-xs hover:text-white/60 transition"
          >
            🎬 View all my videos
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STAGE: ERROR
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(700px_circle_at_50%_20%,rgba(139,92,246,0.18),transparent_60%)]" />
      <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-black/90 backdrop-blur p-6 flex flex-col items-center gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-white font-bold text-base text-center">Something went wrong</p>
        <p className="text-white/50 text-xs text-center">{error ?? "Unknown error"}</p>
        <button
          type="button"
          onClick={() => router.push("/be-the-star")}
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 transition"
        >
          ← Go Back
        </button>
      </div>
    </div>
  );
}
