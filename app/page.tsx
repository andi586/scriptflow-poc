"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Play } from "lucide-react";
import {
  analyzeScriptAction,
  formatStoryIdeaAction,
  generateKlingPromptsAction,
  getStoryMemoryForProjectAction,
  pollKlingTasksAction,
  pollProjectKlingVideoStatusAction,
  pollSingleKlingVideoTaskAction,
  submitKlingTasksAction,
  type StoryMemorySummary,
} from "@/actions/narrative.actions";
import { formatUnknownError } from "@/lib/format-error";
import {
  storyboardShotsToNelScriptText,
  type StoryboardShot,
} from "@/lib/story-idea-format";
import {
  bindTemplateCharactersAction,
  listCharacterTemplatesAction,
  uploadCustomCharacterAction,
} from "@/actions/character.actions";
import { createNewProjectAction } from "@/actions/project.actions";
import type { CharacterRole } from "@/types";

type PromptCard = {
  beat_number: number;
  prompt: string;
};

type TaskCard = {
  beat_number: number;
  task_id: string;
  status: string;
  video_url?: string;
  error_message?: string;
};

type HealthPayload = {
  anthropic: "ok" | "error";
  piapi: "ok" | "error";
  supabase: "ok" | "error";
  errors: Record<string, string>;
};

type CharacterTemplate = {
  id: string;
  label: string;
  role: CharacterRole;
  name: string;
  appearance: string;
  personality: string;
  language_fingerprint: string;
  reference_image_url: string;
};

type PipelinePhase =
  | "idle"
  | "creating_project"
  | "analyzing_story"
  | "locking_characters"
  | "generating_prompts"
  | "submitting_kling"
  | "done"
  | "error";

function errMsg(e: unknown): string {
  return formatUnknownError(e);
}

const PHASE_LABEL: Record<Exclude<PipelinePhase, "idle" | "error">, string> = {
  creating_project: "Creating project...",
  analyzing_story: "Analyzing story...",
  locking_characters: "Locking characters...",
  generating_prompts: "Generating prompts...",
  submitting_kling: "Submitting to Kling...",
  done: "All set!",
};

function phaseProgress(p: PipelinePhase): number {
  switch (p) {
    case "idle":
      return 0;
    case "creating_project":
      return 15;
    case "analyzing_story":
      return 38;
    case "locking_characters":
      return 55;
    case "generating_prompts":
      return 72;
    case "submitting_kling":
      return 90;
    case "done":
      return 100;
    default:
      return 0;
  }
}

function HealthDot({
  label,
  status,
  errorText,
}: {
  label: string;
  status: "ok" | "error" | undefined;
  errorText?: string;
}) {
  const ok = status === "ok";
  const title = ok ? `${label}: OK` : `${label}: ${errorText ?? "error"}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={`inline-block size-2.5 rounded-full ${
          ok ? "bg-emerald-500" : "bg-red-500"
        }`}
        aria-hidden
      />
      <span className="text-[11px] text-white/50">{label}</span>
    </span>
  );
}

export default function Home() {
  const [projectId, setProjectId] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<string | null>(null);
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [taskCards, setTaskCards] = useState<TaskCard[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [projectCreating, setProjectCreating] = useState(false);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterResult, setCharacterResult] = useState<string | null>(null);

  const [nelSummary, setNelSummary] = useState<StoryMemorySummary | null>(null);
  const [nelStoryMemoryId, setNelStoryMemoryId] = useState<string | null>(null);
  const [nelRefreshLoading, setNelRefreshLoading] = useState(false);

  const [entryMode, setEntryMode] = useState<"inspiration" | "script">("inspiration");
  const [storyIdea, setStoryIdea] = useState("");
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[] | null>(null);
  const [inspirationAnalyzing, setInspirationAnalyzing] = useState(false);
  const [inspirationError, setInspirationError] = useState<string | null>(null);

  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [dramaTaskCards, setDramaTaskCards] = useState<TaskCard[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  /** Hidden entry: full manual pipeline (NEL / bind / prompts / submit / poll). */
  const [proMode, setProMode] = useState(false);

  /** Lazy results: PiAPI Kling v1 poll + UI */
  const [lazyPollBusy, setLazyPollBusy] = useState(false);
  const [clipPollErrors, setClipPollErrors] = useState<Record<number, string>>({});
  const [videoUnlocked, setVideoUnlocked] = useState<Record<number, boolean>>({});
  const [zipBusy, setZipBusy] = useState(false);
  const [autoPollActive, setAutoPollActive] = useState(false);
  const lazyPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const isClipDone = (t: TaskCard) => t.status === "success" && !!t.video_url?.trim();
  const isClipFailed = (t: TaskCard) => t.status === "failed";
  const isClipProcessing = (t: TaskCard) => !isClipDone(t) && !isClipFailed(t);

  const refreshLazyPoll = useCallback(async () => {
    if (!projectId.trim()) return;
    setLazyPollBusy(true);
    try {
      const res = await pollProjectKlingVideoStatusAction({ projectId });
      if (res.success) {
        setDramaTaskCards(res.data.tasks);
        const next: Record<number, string> = {};
        for (const [k, v] of Object.entries(res.data.pollErrors)) {
          next[Number(k)] = v;
        }
        setClipPollErrors((prev) => ({ ...prev, ...next }));
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
  }, [projectId]);

  const retryClipPoll = useCallback(
    async (sceneIndex: number) => {
      if (!projectId.trim()) return;
      setClipPollErrors((prev) => {
        const n = { ...prev };
        delete n[sceneIndex];
        return n;
      });
      setLazyPollBusy(true);
      try {
        const res = await pollSingleKlingVideoTaskAction({ projectId, sceneIndex });
        if (res.success) {
          setDramaTaskCards(res.data.tasks);
          if (res.data.pollError) {
            setClipPollErrors((prev) => ({ ...prev, [sceneIndex]: res.data.pollError! }));
          }
        }
      } finally {
        setLazyPollBusy(false);
      }
    },
    [projectId],
  );

  const downloadAllAsZip = useCallback(async () => {
    const clips = dramaTaskCards.filter(
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
          /* CORS — cannot add to zip from browser */
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
  }, [dramaTaskCards]);

  useEffect(() => {
    if (pipelinePhase !== "done" || !projectId.trim()) {
      if (lazyPollIntervalRef.current) {
        clearInterval(lazyPollIntervalRef.current);
        lazyPollIntervalRef.current = null;
      }
      setAutoPollActive(false);
      return;
    }

    void refreshLazyPoll();
    setAutoPollActive(true);
    lazyPollIntervalRef.current = setInterval(() => void refreshLazyPoll(), 30_000);

    return () => {
      if (lazyPollIntervalRef.current) {
        clearInterval(lazyPollIntervalRef.current);
        lazyPollIntervalRef.current = null;
      }
      setAutoPollActive(false);
    };
  }, [pipelinePhase, projectId, refreshLazyPoll]);

  function updateStoryboardShot(index: number, patch: Partial<StoryboardShot>) {
    setStoryboardShots((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : null,
    );
  }

  const canRunDrama = useCallback(() => {
    if (entryMode === "script") return scriptText.trim().length >= 50;
    return (
      storyIdea.trim().length >= 8 ||
      (storyboardShots !== null && storyboardShots.length > 0)
    );
  }, [entryMode, scriptText, storyIdea, storyboardShots]);

  const runDramaPipeline = useCallback(async () => {
    setPipelineError(null);
    setDramaTaskCards([]);
    setPipelineRunning(true);
    /** Tracks which phase we were in when a thrown error (e.g. network timeout) happens */
    let activePhase: PipelinePhase = "creating_project";
    setPipelinePhase("creating_project");

    try {
      activePhase = "creating_project";
      const cr = await createNewProjectAction();
      if (!cr.success) {
        throw new Error(errMsg(cr.error));
      }
      const pid = cr.data.projectId;
      setProjectId(pid);

      activePhase = "analyzing_story";
      setPipelinePhase("analyzing_story");
      let nelScript: string;
      if (entryMode === "script") {
        nelScript = scriptText.trim();
        if (nelScript.length < 50) {
          throw new Error("Script is too short for analysis (need at least 50 characters).");
        }
      } else if (storyboardShots && storyboardShots.length > 0) {
        nelScript = storyboardShotsToNelScriptText(storyboardShots);
      } else {
        const fr = await formatStoryIdeaAction({ idea: storyIdea });
        if (!fr.success) throw new Error(errMsg(fr.error));
        nelScript = storyboardShotsToNelScriptText(fr.data.shots);
        setStoryboardShots(fr.data.shots);
      }

      const ar = await analyzeScriptAction({ projectId: pid, scriptText: nelScript });
      if (!ar.success) throw new Error(errMsg(ar.error));
      setNelSummary(ar.data.summary);
      setNelStoryMemoryId(ar.data.storyMemoryId);
      setScriptText(nelScript);

      activePhase = "locking_characters";
      setPipelinePhase("locking_characters");
      if (selectedTemplateIds.length > 0) {
        const br = await bindTemplateCharactersAction({
          projectId: pid,
          templateIds: selectedTemplateIds,
        });
        if (!br.success) throw new Error(errMsg(br.error));
      }

      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      const gr = await generateKlingPromptsAction({ projectId: pid });
      if (!gr.success) throw new Error(errMsg(gr.error));
      setPromptCards(gr.data.prompts);

      activePhase = "submitting_kling";
      setPipelinePhase("submitting_kling");
      const sr = await submitKlingTasksAction({
        projectId: pid,
        prompts: gr.data.prompts,
      });
      if (!sr.success) throw new Error(errMsg(sr.error));
      setTaskCards(sr.data.tasks);
      setDramaTaskCards(sr.data.tasks);

      setPipelinePhase("done");
    } catch (e) {
      setPipelinePhase("error");
      const raw = e instanceof Error ? e.message : errMsg(e);
      const stepLabel: Record<string, string> = {
        creating_project: "Creating project",
        analyzing_story: "Analyzing story (NEL)",
        locking_characters: "Locking characters",
        generating_prompts: "Generating Kling prompts",
        submitting_kling: "Submitting to Kling",
      };
      const where = stepLabel[activePhase] ?? activePhase;
      const isNet =
        /load failed|failed to fetch|networkerror|aborted|timeout/i.test(raw) ||
        raw === "Load failed";
      const netHint = isNet
        ? ` Often caused by Vercel serverless timeout while calling Claude or PiAPI. We increased maxDuration to 300s and trimmed prompt payload — redeploy and retry. Failed during: ${where}.`
        : "";
      setPipelineError(`${where}: ${raw}${netHint}`);
    } finally {
      setPipelineRunning(false);
    }
  }, [
    entryMode,
    scriptText,
    storyIdea,
    storyboardShots,
    selectedTemplateIds,
  ]);

  useEffect(() => {
    fetch("/api/healthcheck")
      .then((r) => r.json())
      .then((data: HealthPayload) => setHealth(data))
      .catch(() =>
        setHealth({
          anthropic: "error",
          piapi: "error",
          supabase: "error",
          errors: { network: "Failed to fetch /api/healthcheck" },
        }),
      );
  }, []);

  useEffect(() => {
    listCharacterTemplatesAction().then((res) => {
      if (res.success) setTemplates(res.data.templates as CharacterTemplate[]);
    });
  }, []);

  const showProgress = pipelinePhase !== "idle";
  const progressPct =
    pipelinePhase === "error" ? phaseProgress("submitting_kling") : phaseProgress(pipelinePhase);

  const estimatedMinutes = Math.max(2, Math.ceil((dramaTaskCards.length || 6) * 1.5));

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav: Pro Mode pinned to the far right */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <nav
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-3"
          aria-label="Primary"
        >
          <div className="min-w-0 shrink text-xl font-extrabold tracking-tight">ScriptFlow</div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              className="flex max-w-[min(100%,14rem)] flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:max-w-none sm:gap-3 sm:px-3 sm:py-1.5"
              aria-label="API health"
            >
              <HealthDot
                label="Anthropic"
                status={health?.anthropic}
                errorText={health?.errors?.anthropic}
              />
              <HealthDot label="PiAPI" status={health?.piapi} errorText={health?.errors?.piapi} />
              <HealthDot
                label="Supabase"
                status={health?.supabase}
                errorText={health?.errors?.supabase}
              />
            </div>
            <button
              type="button"
              onClick={() => setProMode((v) => !v)}
              className="whitespace-nowrap rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 shadow-sm shadow-amber-900/20 transition hover:border-amber-400/70 hover:bg-amber-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              aria-expanded={proMode}
              aria-controls="pro-mode-panel"
            >
              {proMode ? "Exit Pro Mode" : "Pro Mode"}
            </button>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-12">
        <p className="text-sm text-white/60">从你的灵感，到你的短剧。</p>

        {/* —— Main lazy flow —— */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-amber-400">Your story</h2>
          <p className="mt-1 text-xs text-white/45">
            Pick a mode, optional cast, then one tap — we handle the rest.
          </p>

          {entryMode === "inspiration" ? (
            <div className="mt-4 space-y-4">
              <label className="text-sm font-medium text-white/80">Inspiration</label>
              <textarea
                value={storyIdea}
                onChange={(e) => setStoryIdea(e.target.value)}
                rows={5}
                placeholder={
                  "Tell me your story idea...\n(e.g. 'A werewolf CEO falls for a human girl,\nbut his old enemy arrives')"
                }
                className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                className="text-left text-sm text-amber-300/90 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                onClick={() => {
                  setEntryMode("script");
                  setInspirationError(null);
                }}
              >
                Already have a script? Switch to Script Mode
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="text-sm font-medium text-white/80">Script</label>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={12}
                placeholder="Paste your formatted script here..."
                className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                className="text-left text-sm text-amber-300/90 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                onClick={() => {
                  setEntryMode("inspiration");
                  setInspirationError(null);
                }}
              >
                Switch to Inspiration Mode
              </button>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-amber-400">Cast (optional)</h2>
          <p className="mt-1 text-xs text-white/45">Choose look templates to lock into your drama.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {templates.map((tpl) => {
              const checked = selectedTemplateIds.includes(tpl.id);
              return (
                <label
                  key={tpl.id}
                  className={`cursor-pointer rounded-xl border p-3 text-sm ${
                    checked ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-zinc-950/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedTemplateIds((prev) =>
                        e.target.checked ? [...prev, tpl.id] : prev.filter((id) => id !== tpl.id),
                      );
                    }}
                  />
                  {tpl.label}
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-black/40 p-6">
          <Button
            type="button"
            disabled={pipelineRunning || !canRunDrama()}
            className="h-12 w-full bg-amber-500 text-base font-semibold text-black hover:bg-amber-400 disabled:opacity-40"
            onClick={() => void runDramaPipeline()}
          >
            {pipelineRunning ? "Working on it…" : "Generate My Drama"}
          </Button>
          {!canRunDrama() && !pipelineRunning && (
            <p className="mt-2 text-center text-xs text-white/40">
              {entryMode === "script"
                ? "Paste a script with at least 50 characters."
                : "Enter a story idea (8+ characters), or open Pro Mode → preview 9 shots to refine first."}
            </p>
          )}

          {showProgress && (
            <div className="mt-6 space-y-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-center text-sm text-amber-200/95">
                {pipelinePhase === "error"
                  ? "Something went wrong"
                  : PHASE_LABEL[pipelinePhase as keyof typeof PHASE_LABEL] ?? ""}
              </p>
              <p className="text-center text-[11px] text-white/35">
                Creating project → Analyzing story → Locking characters → Generating prompts →
                Submitting to Kling
              </p>
            </div>
          )}

          {pipelineError && (
            <p className="mt-4 text-center text-sm text-red-400" role="alert">
              {pipelineError}
            </p>
          )}

          {pipelinePhase === "done" && dramaTaskCards.length > 0 && (
            <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Your clips</h3>
                {dramaTaskCards.every(isClipDone) && (
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
                {autoPollActive ? (
                  <>
                    已开启自动同步（每 30 秒）· PiAPI Kling 视频状态
                    {lazyPollBusy ? (
                      <Loader2 className="ml-1 inline size-3.5 animate-spin text-amber-400" aria-hidden />
                    ) : null}
                  </>
                ) : (
                  <>
                    全部场景已结束（成功或失败）。原始排队约{" "}
                    <strong className="text-amber-200">{estimatedMinutes} 分钟</strong>（估算）。
                  </>
                )}
              </p>
              <div className="grid gap-4">
                {dramaTaskCards.map((task) => {
                  const done = isClipDone(task);
                  const failed = isClipFailed(task);
                  const processing = isClipProcessing(task);
                  const pollErr = clipPollErrors[task.beat_number];
                  const unlocked = !!videoUnlocked[task.beat_number];
                  return (
                    <div
                      key={task.task_id || `scene-${task.beat_number}`}
                      className="rounded-xl border border-white/10 bg-zinc-950/70 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold text-amber-400">
                          Scene {task.beat_number}
                        </span>
                        {processing && (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium capitalize text-amber-200">
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              Processing
                            </span>
                          </>
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
                            onClick={() => void retryClipPoll(task.beat_number)}
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
                            onClick={() => void retryClipPoll(task.beat_number)}
                          >
                            重试
                          </Button>
                        </div>
                      )}

                      {done && task.video_url && (
                        <div className="relative mt-3 overflow-hidden rounded-lg border border-white/10 bg-black">
                          <video
                            ref={(el) => {
                              clipVideoRefs.current[task.beat_number] = el;
                            }}
                            src={task.video_url}
                            className="max-h-64 w-full object-cover"
                            playsInline
                            preload="metadata"
                            controls={unlocked}
                            muted={!unlocked}
                            onPlay={() =>
                              setVideoUnlocked((u) => ({ ...u, [task.beat_number]: true }))
                            }
                          />
                          {!unlocked && (
                            <button
                              type="button"
                              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 transition hover:bg-black/45"
                              onClick={() => {
                                setVideoUnlocked((u) => ({ ...u, [task.beat_number]: true }));
                                requestAnimationFrame(() => {
                                  const v = clipVideoRefs.current[task.beat_number];
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
          )}
        </section>

        {/* —— Pro Mode: same server actions, full manual control (hidden until toggled) —— */}
        {proMode && (
        <section
          id="pro-mode-panel"
          className="mt-10 rounded-2xl border border-amber-500/25 bg-white/[0.03] p-5"
          aria-label="Pro mode manual pipeline"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-400">Pro Mode</h2>
              <p className="mt-1 max-w-xl text-xs text-white/45">
                Step-by-step control: NEL analysis, character bind, Kling prompts, task submit/poll.
                Same backend as &quot;Generate My Drama&quot; — run only the steps you need.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProMode(false)}
              className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-8">
            {entryMode === "inspiration" && (
              <div className="space-y-3">
                <p className="text-xs text-white/45">
                  Optional: generate and edit 9 shots before using the main button (otherwise the
                  one-shot flow creates them automatically).
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={inspirationAnalyzing}
                  onClick={async () => {
                    setInspirationError(null);
                    setInspirationAnalyzing(true);
                    const res = await formatStoryIdeaAction({ idea: storyIdea });
                    if (res.success) setStoryboardShots(res.data.shots);
                    else {
                      setStoryboardShots(null);
                      setInspirationError(errMsg(res.error));
                    }
                    setInspirationAnalyzing(false);
                  }}
                >
                  {inspirationAnalyzing ? "Analyzing…" : "Preview 9 shots only"}
                </Button>
                {inspirationError && (
                  <p className="text-sm text-red-400">{inspirationError}</p>
                )}
                {storyboardShots && (
                  <div className="grid gap-3">
                    {storyboardShots.map((shot, index) => (
                      <div
                        key={`${shot.number}-${index}`}
                        className="rounded-xl border border-white/10 bg-zinc-950/70 p-3 text-xs"
                      >
                        <div className="mb-2 font-semibold text-amber-400">Shot {shot.number}</div>
                        <textarea
                          value={shot.sceneDescription}
                          onChange={(e) =>
                            updateStoryboardShot(index, { sceneDescription: e.target.value })
                          }
                          rows={2}
                          className="mb-2 w-full rounded border border-white/10 bg-black/40 p-2 text-white"
                        />
                        <textarea
                          value={shot.dialogueOrVoiceover}
                          onChange={(e) =>
                            updateStoryboardShot(index, { dialogueOrVoiceover: e.target.value })
                          }
                          rows={2}
                          className="mb-2 w-full rounded border border-white/10 bg-black/40 p-2 text-white"
                        />
                        <input
                          value={shot.emotionalTone}
                          onChange={(e) =>
                            updateStoryboardShot(index, { emotionalTone: e.target.value })
                          }
                          className="w-full rounded border border-white/10 bg-black/40 p-2 text-white"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400/90">NEL · story_memory</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={nelRefreshLoading || !projectId.trim()}
                onClick={async () => {
                  setNelRefreshLoading(true);
                  const res = await getStoryMemoryForProjectAction({ projectId });
                  if (res.success) {
                    setNelSummary(res.data.summary);
                    setNelStoryMemoryId(res.data.storyMemoryId);
                    setResult(`OK: loaded story_memory.id=${res.data.storyMemoryId}`);
                  } else {
                    setNelSummary(null);
                    setNelStoryMemoryId(null);
                    setResult(`Error: ${errMsg(res.error)}`);
                  }
                  setNelRefreshLoading(false);
                }}
              >
                {nelRefreshLoading ? "Loading…" : "Load / refresh from Supabase"}
              </Button>
              {nelStoryMemoryId && (
                <p className="text-xs text-white/50">
                  story_memory.id{" "}
                  <code className="text-amber-200/80">{nelStoryMemoryId}</code>
                </p>
              )}
              {nelSummary && (
                <div className="rounded-xl border border-white/10 bg-zinc-950/70 p-3 text-xs text-white/75">
                  <p>{nelSummary.narrativeArc?.slice(0, 400)}…</p>
                  <p className="mt-2 text-white/50">
                    Beats {nelSummary.beatCount} · Characters {nelSummary.characterCount}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <label className="text-sm text-white/70">Project ID</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={projectCreating}
                  onClick={async () => {
                    setProjectCreating(true);
                    const res = await createNewProjectAction();
                    if (res.success) setProjectId(res.data.projectId);
                    setProjectCreating(false);
                  }}
                >
                  {projectCreating ? "…" : "New Project"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={characterLoading || !projectId.trim()}
                onClick={async () => {
                  setCharacterLoading(true);
                  const res = await bindTemplateCharactersAction({
                    projectId,
                    templateIds: selectedTemplateIds,
                  });
                  setCharacterResult(
                    res.success
                      ? `OK: bound ${res.data.count}`
                      : `Error: ${errMsg(res.error)}`,
                  );
                  setCharacterLoading(false);
                }}
              >
                Bind templates only
              </Button>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs">
                Upload ref
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !projectId) return;
                    setCharacterLoading(true);
                    const base64 = await file.arrayBuffer().then((buf) => {
                      let binary = "";
                      const bytes = new Uint8Array(buf);
                      const chunk = 0x8000;
                      for (let i = 0; i < bytes.length; i += chunk) {
                        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
                      }
                      return btoa(binary);
                    });
                    const res = await uploadCustomCharacterAction({
                      projectId,
                      name: file.name.replace(/\.[a-zA-Z0-9]+$/, ""),
                      role: "supporting",
                      fileName: file.name,
                      mimeType: file.type || "image/jpeg",
                      base64Data: base64,
                    });
                    setCharacterResult(
                      res.success ? `OK: ${res.data.path}` : `Error: ${errMsg(res.error)}`,
                    );
                    setCharacterLoading(false);
                  }}
                />
              </label>
            </div>
            {characterResult && <p className="text-xs text-white/60">{characterResult}</p>}

            <div className="space-y-2">
              <Button
                size="sm"
                className="bg-amber-500 text-black"
                disabled={loading || !projectId.trim()}
                onClick={async () => {
                  setLoading(true);
                  const res = await analyzeScriptAction({ projectId, scriptText });
                  if (res.success) {
                    setNelSummary(res.data.summary);
                    setNelStoryMemoryId(res.data.storyMemoryId);
                    setResult("OK");
                  } else setResult(`Error: ${errMsg(res.error)}`);
                  setLoading(false);
                }}
              >
                {loading ? "…" : "Analyze script only"}
              </Button>
              {result && <p className="text-xs text-white/50">{result}</p>}
            </div>

            <div className="space-y-2">
              <Button
                size="sm"
                className="bg-amber-500 text-black"
                disabled={promptLoading || !projectId.trim()}
                onClick={async () => {
                  setPromptLoading(true);
                  const res = await generateKlingPromptsAction({ projectId });
                  if (res.success) {
                    setPromptCards(res.data.prompts);
                    setPromptResult(`OK: ${res.data.prompts.length}`);
                  } else setPromptResult(`Error: ${errMsg(res.error)}`);
                  setPromptLoading(false);
                }}
              >
                {promptLoading ? "…" : "Generate prompts only"}
              </Button>
              {promptResult && <p className="text-xs text-white/50">{promptResult}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-amber-500 text-black"
                disabled={videoLoading || !projectId.trim() || promptCards.length === 0}
                onClick={async () => {
                  setVideoLoading(true);
                  const res = await submitKlingTasksAction({ projectId, prompts: promptCards });
                  if (res.success) {
                    setTaskCards(res.data.tasks);
                    setVideoResult(`Submitted ${res.data.tasks.length}`);
                  } else setVideoResult(`Error: ${errMsg(res.error)}`);
                  setVideoLoading(false);
                }}
              >
                Submit Kling only
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pollLoading || !projectId.trim() || promptCards.length === 0}
                onClick={async () => {
                  setPollLoading(true);
                  const res = await pollKlingTasksAction({
                    projectId,
                    sceneIndices: promptCards.map((t) => t.beat_number),
                  });
                  if (res.success) {
                    setTaskCards(res.data.tasks);
                    setVideoResult("Polled");
                  } else setVideoResult(`Error: ${errMsg(res.error)}`);
                  setPollLoading(false);
                }}
              >
                Poll status
              </Button>
            </div>
            {videoResult && <p className="text-xs text-white/50">{videoResult}</p>}

            {promptCards.length > 0 && (
              <div className="max-h-64 overflow-y-auto text-xs text-white/50">
                {promptCards.map((p) => (
                  <div key={p.beat_number} className="mb-2 border-b border-white/5 pb-2">
                    Scene {p.beat_number}: {p.prompt.slice(0, 120)}…
                  </div>
                ))}
              </div>
            )}

            {taskCards.length > 0 && (
              <div className="text-xs text-white/50">
                {taskCards.map((t) => (
                  <div key={t.beat_number}>
                    Scene {t.beat_number} · {t.status} · task_id {t.task_id || "—"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}
      </main>
    </div>
  );
}
