"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export type RenderJobStatus = "queued" | "running" | "done" | "failed";
export type RenderJobStage =
  | "queued"
  | "script_generating"
  | "video_generating"
  | "voice_generating"
  | "merging"
  | "completed"
  | "failed";

export type RenderJobState = {
  jobId: string;
  status: RenderJobStatus;
  stage: RenderJobStage;
  progress: number;
  error: string | null;
  output: {
    finalVideoUrl?: string | null;
    taskIds?: string[];
    finalizeError?: string;
  } | null;
};

const STAGE_LABEL: Record<RenderJobStage, string> = {
  queued: "Queued...",
  script_generating: "Writing your script...",
  video_generating: "Generating scenes...",
  voice_generating: "Adding voices...",
  merging: "Mixing final cut...",
  completed: "All done!",
  failed: "Something went wrong",
};

const POLL_INTERVAL_MS = 5_000;

type Props = {
  jobId: string;
  /** Called when job completes with a final video URL */
  onComplete?: (finalVideoUrl: string | null, taskIds: string[]) => void;
  /** Called when job fails */
  onFailed?: (error: string) => void;
  /** Called when user clicks "Start Over" */
  onStartOver?: () => void;
};

export function RenderJobProgress({ jobId, onComplete, onFailed, onStartOver }: Props) {
  const [state, setState] = useState<RenderJobState>({
    jobId,
    status: "queued",
    stage: "queued",
    progress: 0,
    error: null,
    output: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/render-jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as {
        success: boolean;
        jobId: string;
        status: RenderJobStatus;
        stage: RenderJobStage;
        progress: number;
        error: string | null;
        output: RenderJobState["output"];
      };
      if (!data.success) return;

      setState({
        jobId: data.jobId,
        status: data.status,
        stage: data.stage,
        progress: data.progress,
        error: data.error,
        output: data.output,
      });

      if ((data.status === "done" || data.status === "failed") && !completedRef.current) {
        completedRef.current = true;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (data.status === "done") {
          onComplete?.(data.output?.finalVideoUrl ?? null, data.output?.taskIds ?? []);
        } else {
          onFailed?.(data.error ?? "Unknown error");
        }
      }
    } catch {
      // transient network error — keep polling
    }
  }, [jobId, onComplete, onFailed]);

  useEffect(() => {
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  const { status, stage, progress, error, output } = state;
  const isDone = status === "done";
  const isFailed = status === "failed";
  const isActive = status === "queued" || status === "running";

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {isActive && <Loader2 className="size-5 shrink-0 animate-spin text-amber-400" aria-hidden />}
        {isDone && <CheckCircle className="size-5 shrink-0 text-emerald-400" aria-hidden />}
        {isFailed && <XCircle className="size-5 shrink-0 text-red-400" aria-hidden />}
        <p className="text-sm font-semibold text-white">
          {STAGE_LABEL[stage] ?? "Processing..."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isFailed ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-right text-xs text-white/40">{progress}%</p>

      {/* Keep-open warning while active */}
      {isActive && (
        <div className="rounded-xl border border-orange-500/60 bg-orange-500/15 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-orange-300">
            ⚠️ Keep this page open — generating your scenes...
          </p>
          <p className="mt-1 text-xs text-orange-200/70">
            You can switch tabs and come back — progress is saved.
          </p>
        </div>
      )}

      {/* Error */}
      {isFailed && error && (
        <div className="space-y-3">
          <p className="text-sm text-red-400" role="alert">{error}</p>
          {onStartOver && (
            <button
              type="button"
              onClick={onStartOver}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-all"
            >
              <RefreshCw className="size-4" aria-hidden />
              Start Over
            </button>
          )}
        </div>
      )}

      {/* Done — show final video */}
      {isDone && output?.finalVideoUrl && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-emerald-300">🎬 Your drama is ready!</p>
          <video
            src={output.finalVideoUrl}
            controls
            className="w-full rounded-xl border border-white/10"
            style={{ maxHeight: 480 }}
          />
          <a
            href={output.finalVideoUrl}
            download
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 transition-all"
          >
            ⬇ Download Video
          </a>
        </div>
      )}

      {/* Done but no final video (clips only) */}
      {isDone && !output?.finalVideoUrl && (
        <p className="text-sm text-white/60">
          Scenes generated! Check the clips panel below.
          {output?.finalizeError && (
            <span className="ml-1 text-amber-300">(Finalize: {output.finalizeError})</span>
          )}
        </p>
      )}
    </div>
  );
}
