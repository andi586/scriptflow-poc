"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Play } from "lucide-react";
import {
  listKlingTaskIdsForSessionAction,
  pollSessionKlingVideoStatusAction,
  pollSingleSessionKlingVideoTaskAction,
  type KlingTaskItem,
} from "@/actions/narrative.actions";

export type VideoResultsPanelProps = {
  /** Supabase `projects.id` — scopes `kling_tasks` rows. */
  sessionId: string;
  /**
   * PiAPI task ids (order preserved). If omitted or empty, loads all `task_id` from
   * `kling_tasks` for this session, then polls.
   */
  taskIds?: string[];
  /** Section heading */
  title?: string;
  /** Default: true */
  autoPoll?: boolean;
  /** Default: 30_000 */
  pollIntervalMs?: number;
  className?: string;
};

function isClipDone(t: KlingTaskItem) {
  return t.status === "success" && !!t.video_url?.trim();
}
function isClipFailed(t: KlingTaskItem) {
  return t.status === "failed";
}
function isClipProcessing(t: KlingTaskItem) {
  return !isClipDone(t) && !isClipFailed(t);
}

export function VideoResultsPanel({
  sessionId,
  taskIds: taskIdsProp = [],
  title = "Your clips",
  autoPoll = true,
  pollIntervalMs = 30_000,
  className = "",
}: VideoResultsPanelProps) {
  const [tasks, setTasks] = useState<KlingTaskItem[]>([]);
  const [lazyPollBusy, setLazyPollBusy] = useState(false);
  const [clipPollErrors, setClipPollErrors] = useState<Record<string, string>>({});
  const [videoUnlocked, setVideoUnlocked] = useState<Record<string, boolean>>({});
  const [zipBusy, setZipBusy] = useState(false);
  const [autoPollActive, setAutoPollActive] = useState(false);
  const [dbTaskIds, setDbTaskIds] = useState<string[] | undefined>(undefined);
  const [dbLoadError, setDbLoadError] = useState<string | null>(null);
  const lazyPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const taskIdsRef = useRef<string[]>([]);

  const propTaskIdsKey = useMemo(
    () => taskIdsProp.map((t) => t.trim()).filter(Boolean).join("\0"),
    [taskIdsProp],
  );

  const effectiveIds = useMemo(() => {
    const fromProp = taskIdsProp.map((t) => t.trim()).filter(Boolean);
    if (fromProp.length > 0) return fromProp;
    if (dbTaskIds !== undefined) return dbTaskIds;
    return [];
  }, [taskIdsProp, dbTaskIds]);

  const stillResolvingIds =
    taskIdsProp.map((t) => t.trim()).filter(Boolean).length === 0 && dbTaskIds === undefined;

  const effectiveKey = effectiveIds.join("\0");

  useEffect(() => {
    taskIdsRef.current = effectiveIds;
  }, [effectiveKey]);

  useEffect(() => {
    if (!sessionId.trim()) {
      setDbTaskIds(undefined);
      setDbLoadError(null);
      return;
    }
    const fromProp = taskIdsProp.map((t) => t.trim()).filter(Boolean);
    if (fromProp.length > 0) {
      setDbTaskIds(undefined);
      setDbLoadError(null);
      return;
    }

    let cancelled = false;
    setDbLoadError(null);
    (async () => {
      const res = await listKlingTaskIdsForSessionAction({ sessionId });
      if (cancelled) return;
      if (res.success) {
        setDbTaskIds(res.data.taskIds);
      } else {
        setDbTaskIds([]);
        setDbLoadError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, propTaskIdsKey]);

  const estimatedMinutes = Math.max(2, Math.ceil((effectiveIds.length || 6) * 1.5));

  const refreshSessionPoll = useCallback(async () => {
    const ids = taskIdsRef.current.map((t) => t.trim()).filter(Boolean);
    if (!sessionId.trim() || ids.length === 0) return;
    setLazyPollBusy(true);
    try {
      const res = await pollSessionKlingVideoStatusAction({ sessionId, taskIds: ids });
      if (res.success) {
        setTasks(res.data.tasks);
        setClipPollErrors((prev) => ({ ...prev, ...res.data.pollErrors }));
        const allTerminal = res.data.tasks.every(
          (t) => t.status === "success" || t.status === "failed",
        );
        if (allTerminal && lazyPollIntervalRef.current) {
          clearInterval(lazyPollIntervalRef.current);
          lazyPollIntervalRef.current = null;
          setAutoPollActive(false);
        }
      }
    } finally {
      setLazyPollBusy(false);
    }
  }, [sessionId]);

  const retryClipPoll = useCallback(
    async (taskId: string) => {
      if (!sessionId.trim()) return;
      const ids = taskIdsRef.current.map((t) => t.trim()).filter(Boolean);
      setClipPollErrors((prev) => {
        const n = { ...prev };
        delete n[taskId];
        return n;
      });
      setLazyPollBusy(true);
      try {
        const res = await pollSingleSessionKlingVideoTaskAction({
          sessionId,
          taskId,
          taskIds: ids,
        });
        if (res.success) {
          setTasks(res.data.tasks);
          if (res.data.pollError) {
            setClipPollErrors((prev) => ({ ...prev, [taskId]: res.data.pollError! }));
          }
        }
      } finally {
        setLazyPollBusy(false);
      }
    },
    [sessionId],
  );

  const downloadAllAsZip = useCallback(async () => {
    const clips = tasks.filter(
      (t) => t.status === "success" && !!t.video_url?.trim(),
    );
    if (clips.length === 0) return;
    setZipBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let added = 0;
      for (const t of clips) {
        const url = t.video_url!;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(String(res.status));
          const buf = await res.arrayBuffer();
          zip.file(`scene_${t.beat_number}.mp4`, buf);
          added += 1;
        } catch {
          /* CORS */
        }
      }
      if (added > 0) {
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scriptflow_clips.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      for (const t of clips) {
        const a = document.createElement("a");
        a.href = t.video_url!;
        a.download = `scene_${t.beat_number}.mp4`;
        a.rel = "noreferrer";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setZipBusy(false);
    }
  }, [tasks]);

  useEffect(() => {
    if (!sessionId.trim() || stillResolvingIds) {
      if (lazyPollIntervalRef.current) {
        clearInterval(lazyPollIntervalRef.current);
        lazyPollIntervalRef.current = null;
      }
      setAutoPollActive(false);
      if (!sessionId.trim()) setTasks([]);
      return;
    }

    if (effectiveIds.length === 0) {
      if (lazyPollIntervalRef.current) {
        clearInterval(lazyPollIntervalRef.current);
        lazyPollIntervalRef.current = null;
      }
      setAutoPollActive(false);
      setTasks([]);
      return;
    }

    if (!autoPoll) {
      void refreshSessionPoll();
      return () => {
        setAutoPollActive(false);
      };
    }

    void refreshSessionPoll();
    setAutoPollActive(true);
    lazyPollIntervalRef.current = setInterval(() => void refreshSessionPoll(), pollIntervalMs);

    return () => {
      if (lazyPollIntervalRef.current) {
        clearInterval(lazyPollIntervalRef.current);
        lazyPollIntervalRef.current = null;
      }
      setAutoPollActive(false);
    };
  }, [
    sessionId,
    effectiveKey,
    stillResolvingIds,
    autoPoll,
    pollIntervalMs,
    refreshSessionPoll,
    effectiveIds.length,
  ]);

  if (!sessionId.trim()) return null;

  if (stillResolvingIds) {
    return (
      <div className={className}>
        <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-6 text-sm text-white/55">
          <Loader2 className="size-4 shrink-0 animate-spin text-amber-400" aria-hidden />
          正在从 Supabase 加载任务列表…
        </div>
      </div>
    );
  }

  if (dbLoadError) {
    return (
      <div className={className}>
        <div className="mt-8 space-y-2 border-t border-white/10 pt-6">
          <p className="text-sm text-red-400" role="alert">
            无法加载任务：{dbLoadError}
          </p>
          <p className="text-xs text-white/45">请使用「开始新项目」或检查 session 是否有效。</p>
        </div>
      </div>
    );
  }

  if (effectiveIds.length === 0) return null;

  return (
    <div className={className}>
      <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {tasks.length > 0 && tasks.every(isClipDone) && (
            <Button
              type="button"
              size="sm"
              disabled={zipBusy}
              onClick={() => void downloadAllAsZip()}
              className="border border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
            >
              {zipBusy ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  打包中…
                </>
              ) : (
                <>
                  <Download className="mr-1.5 size-4" aria-hidden />
                  下载全部
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-xs text-white/50">
          {autoPoll && autoPollActive ? (
            <>
              已开启自动同步（每 {Math.round(pollIntervalMs / 1000)} 秒）· PiAPI Kling 视频状态
              {lazyPollBusy ? (
                <Loader2
                  className="ml-1 inline size-3.5 animate-spin text-amber-400"
                  aria-hidden
                />
              ) : null}
            </>
          ) : (
            <>
              {tasks.length > 0 && tasks.every((t) => t.status === "success" || t.status === "failed")
                ? "全部场景已结束（成功或失败）。"
                : "手动刷新或等待任务完成。"}
              {tasks.length > 0 ? (
                <>
                  {" "}
                  原始排队约{" "}
                  <strong className="text-amber-200">{estimatedMinutes} 分钟</strong>（估算）。
                </>
              ) : null}
            </>
          )}
        </p>
        <div className="grid gap-4">
          {tasks.map((task) => {
            const done = isClipDone(task);
            const failed = isClipFailed(task);
            const processing = isClipProcessing(task);
            const pollErr = clipPollErrors[task.task_id];
            const unlocked = !!videoUnlocked[task.task_id];
            const vk = task.task_id || `scene-${task.beat_number}`;
            return (
              <div
                key={vk}
                className="rounded-xl border border-white/10 bg-zinc-950/70 p-4"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-semibold text-amber-400">
                    Scene {task.beat_number}
                  </span>
                  {processing && (
                    <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium capitalize text-amber-200">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Processing
                    </span>
                  )}
                  {done && (
                    <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      Completed
                    </span>
                  )}
                  {failed && (
                    <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-300">
                      Failed
                    </span>
                  )}
                </div>

                {task.error_message && (
                  <p className="mt-2 text-sm text-red-400">{task.error_message}</p>
                )}
                {failed && !pollErr && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-500/40 text-xs text-amber-200"
                      onClick={() => void retryClipPoll(task.task_id)}
                    >
                      重试
                    </Button>
                  </div>
                )}
                {pollErr && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs text-amber-200/90">{pollErr}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-500/40 text-xs text-amber-200"
                      onClick={() => void retryClipPoll(task.task_id)}
                    >
                      重试
                    </Button>
                  </div>
                )}

                {done && task.video_url && (
                  <div className="relative mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
                    <video
                      ref={(el) => {
                        clipVideoRefs.current[vk] = el;
                      }}
                      src={task.video_url}
                      className="max-h-64 w-full object-cover"
                      playsInline
                      preload="metadata"
                      controls={unlocked}
                      muted={!unlocked}
                      onPlay={() =>
                        setVideoUnlocked((u) => ({ ...u, [task.task_id]: true }))
                      }
                    />
                    {!unlocked && (
                      <button
                        type="button"
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 transition hover:bg-black/45"
                        onClick={() => {
                          setVideoUnlocked((u) => ({ ...u, [task.task_id]: true }));
                          requestAnimationFrame(() => {
                            const v = clipVideoRefs.current[vk];
                            if (v) {
                              v.muted = false;
                              void v.play();
                            }
                          });
                        }}
                        aria-label={`Play scene ${task.beat_number}`}
                      >
                        <Play
                          className="size-14 text-amber-400 drop-shadow-md"
                          fill="currentColor"
                          strokeWidth={0}
                        />
                        <span className="text-xs font-medium text-white/90">点击播放</span>
                      </button>
                    )}
                  </div>
                )}

                {done && task.video_url && (
                  <div className="mt-2">
                    <a
                      href={task.video_url}
                      download={`scene_${task.beat_number}.mp4`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                    >
                      <Download className="size-3.5" aria-hidden />
                      下载 scene_{task.beat_number}.mp4
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
