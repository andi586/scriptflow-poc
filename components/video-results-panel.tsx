"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Play } from "lucide-react";
import {
  listKlingTaskIdsForSessionAction,
  pollSessionKlingVideoStatusAction,
  pollSingleSessionKlingVideoTaskAction,
  resolveKlingVideoPlaybackUrlAction,
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

/** DB `video_url` may be expired; success clips still show player after live PiAPI resolve. */
function isClipDone(t: KlingTaskItem) {
  return t.status === "success";
}
function isClipFailed(t: KlingTaskItem) {
  return t.status === "failed";
}
function isClipProcessing(t: KlingTaskItem) {
  return !isClipDone(t) && !isClipFailed(t);
}

/**
 * Stable per-row React/state key: beat + PiAPI task_id so duplicate task_ids or empty ids never share state.
 * PiAPI calls still use `task.task_id.trim()` only.
 */
function clipRowKey(task: KlingTaskItem): string {
  const tid = typeof task.task_id === "string" ? task.task_id.trim() : "";
  const b = Number(task.beat_number);
  const beat = Number.isFinite(b) ? b : 0;
  return tid ? `b${beat}|${tid}` : `b${beat}|notask`;
}

/** Wait for React to commit `src` to the `<video>` DOM node. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function waitForVideoLoaded(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const to = window.setTimeout(() => {
      cleanup();
      reject(new Error("视频加载超时，请重试"));
    }, timeoutMs);
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("视频无法加载，请重试"));
    };
    const cleanup = () => {
      window.clearTimeout(to);
      video.removeEventListener("loadeddata", ok);
      video.removeEventListener("error", bad);
    };
    video.addEventListener("loadeddata", ok, { once: true });
    video.addEventListener("error", bad, { once: true });
  });
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
  /** Fresh URLs from PiAPI at play/download time (not stale DB video_url). */
  const [playUrlByTaskId, setPlayUrlByTaskId] = useState<Record<string, string>>({});
  const [playbackResolving, setPlaybackResolving] = useState<Record<string, boolean>>({});
  const [playbackErrorByTaskId, setPlaybackErrorByTaskId] = useState<Record<string, string>>({});
  const [downloadBusyTaskId, setDownloadBusyTaskId] = useState<string | null>(null);
  const [autoPollActive, setAutoPollActive] = useState(false);
  const [dbTaskIds, setDbTaskIds] = useState<string[] | undefined>(undefined);
  const [dbLoadError, setDbLoadError] = useState<string | null>(null);
  const lazyPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  /** While true, ignore `<video onError>` so empty src / load races don’t show a false error before user intent. */
  const intentionalPlaybackLoadRef = useRef<Set<string>>(new Set());
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

  const fetchFreshPlaybackUrl = useCallback(
    async (
      taskId: string,
      debug?: { beat_number: number; clipRowKey: string },
    ): Promise<string> => {
      const tid = taskId.trim();
      if (!tid) {
        console.warn("[VideoResultsPanel] fetchFreshPlaybackUrl: empty task_id", debug);
        throw new Error("Missing task id");
      }
      const res = await resolveKlingVideoPlaybackUrlAction({
        sessionId,
        taskId: tid,
      });
      if (!res.success) {
        console.warn("[VideoResultsPanel] resolveKlingVideoPlaybackUrl failed", {
          ...debug,
          task_id: taskId,
          task_id_trimmed: tid,
          error: res.error,
        });
        throw new Error(res.error);
      }
      return res.data.videoUrl;
    },
    [sessionId],
  );

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
    const clips = tasks.filter((t) => t.status === "success" && t.task_id.trim());
    if (clips.length === 0) return;
    setZipBusy(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let added = 0;
      for (const t of clips) {
        let url: string;
        try {
          url = await fetchFreshPlaybackUrl(t.task_id, {
            beat_number: t.beat_number,
            clipRowKey: clipRowKey(t),
          });
        } catch {
          continue;
        }
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
        let url: string;
        try {
          url = await fetchFreshPlaybackUrl(t.task_id, {
            beat_number: t.beat_number,
            clipRowKey: clipRowKey(t),
          });
        } catch {
          continue;
        }
        const a = document.createElement("a");
        a.href = url;
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
  }, [tasks, fetchFreshPlaybackUrl]);

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
            const rowKey = clipRowKey(task);
            const piTid = typeof task.task_id === "string" ? task.task_id.trim() : "";
            const pollErr = clipPollErrors[piTid] ?? clipPollErrors[task.task_id];
            const unlocked = !!videoUnlocked[rowKey];
            return (
              <div
                key={rowKey}
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
                      onClick={() => void retryClipPoll(piTid || task.task_id)}
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
                      onClick={() => void retryClipPoll(piTid || task.task_id)}
                    >
                      重试
                    </Button>
                  </div>
                )}

                {done && piTid && (
                  <>
                    {playbackErrorByTaskId[rowKey] && !playbackResolving[rowKey] && (
                      <p className="mt-2 text-xs text-red-400" role="alert">
                        {playbackErrorByTaskId[rowKey]}
                      </p>
                    )}
                    <div className="relative z-10 mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
                      <video
                        key={rowKey}
                        ref={(el) => {
                          clipVideoRefs.current[rowKey] = el;
                        }}
                        src={playUrlByTaskId[rowKey] || undefined}
                        className="max-h-64 w-full object-cover"
                        playsInline
                        preload="metadata"
                        controls={unlocked && !!playUrlByTaskId[rowKey]}
                        muted={!unlocked}
                        onPlay={() =>
                          setVideoUnlocked((u) => ({ ...u, [rowKey]: true }))
                        }
                        onError={() => {
                          if (intentionalPlaybackLoadRef.current.has(rowKey)) {
                            return;
                          }
                          console.warn("[VideoResultsPanel] <video> error", {
                            rowKey,
                            beat_number: task.beat_number,
                            task_id: task.task_id,
                            piTid,
                            srcSample: (playUrlByTaskId[rowKey] ?? "").slice(0, 80),
                          });
                          setPlaybackErrorByTaskId((prev) => ({
                            ...prev,
                            [rowKey]: "播放中断，可再次点击播放获取新地址。",
                          }));
                          setPlayUrlByTaskId((prev) => {
                            const next = { ...prev };
                            delete next[rowKey];
                            return next;
                          });
                          setVideoUnlocked((u) => {
                            const next = { ...u };
                            delete next[rowKey];
                            return next;
                          });
                        }}
                      />
                      {(!unlocked || !playUrlByTaskId[rowKey]) && (
                        <button
                          type="button"
                          disabled={!!playbackResolving[rowKey]}
                          aria-busy={!!playbackResolving[rowKey]}
                          className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/55 transition hover:bg-black/45 ${
                            playbackResolving[rowKey]
                              ? "cursor-wait opacity-80"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (playbackResolving[rowKey]) return;
                            void (async () => {
                              intentionalPlaybackLoadRef.current.add(rowKey);
                              setPlaybackErrorByTaskId((prev) => {
                                const next = { ...prev };
                                delete next[rowKey];
                                return next;
                              });
                              setPlaybackResolving((prev) => ({ ...prev, [rowKey]: true }));
                              try {
                                const url = await fetchFreshPlaybackUrl(piTid, {
                                  beat_number: task.beat_number,
                                  clipRowKey: rowKey,
                                });
                                setPlayUrlByTaskId((prev) => ({ ...prev, [rowKey]: url }));
                                await nextPaint();
                                const v = clipVideoRefs.current[rowKey];
                                if (!v) {
                                  throw new Error("播放器未就绪，请重试");
                                }
                                v.src = url;
                                v.load();
                                await waitForVideoLoaded(v, 60_000);
                                v.muted = false;
                                await v.play();
                                setVideoUnlocked((u) => ({ ...u, [rowKey]: true }));
                              } catch (err) {
                                console.warn("[VideoResultsPanel] play pipeline failed", {
                                  rowKey,
                                  beat_number: task.beat_number,
                                  task_id: task.task_id,
                                  piTid,
                                });
                                setPlaybackErrorByTaskId((prev) => ({
                                  ...prev,
                                  [rowKey]:
                                    err instanceof Error ? err.message : String(err),
                                }));
                                setPlayUrlByTaskId((prev) => {
                                  const next = { ...prev };
                                  delete next[rowKey];
                                  return next;
                                });
                                setVideoUnlocked((u) => {
                                  const next = { ...u };
                                  delete next[rowKey];
                                  return next;
                                });
                              } finally {
                                intentionalPlaybackLoadRef.current.delete(rowKey);
                                setPlaybackResolving((prev) => {
                                  const next = { ...prev };
                                  delete next[rowKey];
                                  return next;
                                });
                              }
                            })();
                          }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          aria-label={`Play scene ${task.beat_number}`}
                        >
                          {playbackResolving[rowKey] ? (
                            <Loader2
                              className="size-14 animate-spin text-amber-400"
                              aria-hidden
                            />
                          ) : (
                            <Play
                              className="size-14 text-amber-400 drop-shadow-md"
                              fill="currentColor"
                              strokeWidth={0}
                            />
                          )}
                          <span className="text-xs font-medium text-white/90">
                            {playbackResolving[rowKey]
                              ? "正在从 PiAPI 获取播放地址…"
                              : "点击播放"}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="mt-2">
                      <button
                        type="button"
                        aria-busy={downloadBusyTaskId === rowKey}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (downloadBusyTaskId === rowKey) return;
                          void (async () => {
                            setPlaybackErrorByTaskId((prev) => {
                              const next = { ...prev };
                              delete next[rowKey];
                              return next;
                            });
                            setDownloadBusyTaskId(rowKey);
                            try {
                              const url = await fetchFreshPlaybackUrl(piTid, {
                                beat_number: task.beat_number,
                                clipRowKey: rowKey,
                              });
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `scene_${task.beat_number}.mp4`;
                              a.rel = "noreferrer";
                              a.target = "_blank";
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            } catch (err) {
                              console.warn("[VideoResultsPanel] download resolve failed", {
                                rowKey,
                                beat_number: task.beat_number,
                                task_id: task.task_id,
                                piTid,
                              });
                              setPlaybackErrorByTaskId((prev) => ({
                                ...prev,
                                [rowKey]:
                                  err instanceof Error ? err.message : String(err),
                              }));
                            } finally {
                              setDownloadBusyTaskId(null);
                            }
                          })();
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 ${
                          downloadBusyTaskId === rowKey
                            ? "cursor-wait opacity-60"
                            : ""
                        }`}
                      >
                        {downloadBusyTaskId === rowKey ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Download className="size-3.5" aria-hidden />
                        )}
                        下载 scene_{task.beat_number}.mp4
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
