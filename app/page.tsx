"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  analyzeScriptAction,
  formatStoryIdeaAction,
  generateKlingPromptsAction,
  submitKlingTasksAction,
} from "@/actions/narrative.actions";
import { InspirationFollowUpCards } from "@/components/inspiration-follow-up-cards";
import { VideoResultsPanel } from "@/components/video-results-panel";
import { formatUnknownError } from "@/lib/format-error";
import {
  clearLazySessionFromStorage,
  readLazySessionIdFromStorage,
  SCRIPTFLOW_SESSION_STORAGE_KEY,
  writeKlingTaskSnapshotToStorage,
  writeLazySessionIdToStorage,
} from "@/lib/lazy-session-storage";
import { storyboardShotsToNelScriptText } from "@/lib/story-idea-format";
import {
  bindTemplateCharactersAction,
  listCharacterTemplatesAction,
  uploadCustomCharacterAction,
} from "@/actions/character.actions";
import { createNewProjectAction } from "@/actions/project.actions";
import {
  composeInspirationForNel,
  inspirationReadyForGenerate,
  shouldShowInspirationFollowUps,
  type InspirationFollowUpAnswers,
} from "@/lib/inspiration-follow-up";
import { cn } from "@/lib/utils";
import type { CharacterRole } from "@/types";

/** Pasted scripts at least this long skip idea→9-shot formatting and go straight to NEL. */
const DIRECT_SCRIPT_MIN_CHARS = 50;

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

type CastConfirmChoice = "template" | "upload";

type CastConfirmation = {
  choice: CastConfirmChoice;
  file?: File;
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
const CAST_IMAGE_PLACEHOLDER_URL = "https://placehold.co/240x320?text=No+Image";

function errMsg(e: unknown): string {
  return formatUnknownError(e);
}

function resolveRenderableImageSrc(rawUrl: string | null | undefined, fallback: string) {
  const value = (rawUrl ?? "").trim();
  if (!value) return fallback;
  const lowered = value.toLowerCase();
  if (lowered === "null" || lowered === "undefined") return fallback;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  return fallback;
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
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [castConfirmations, setCastConfirmations] = useState<Record<string, CastConfirmation>>({});
  const [uploadingCastId, setUploadingCastId] = useState<string | null>(null);

  const [storyIdea, setStoryIdea] = useState("");
  /** Follow-up Q&A per dimension; not merged into textarea — merged only when calling backend. */
  const [inspirationFollowUpAnswers, setInspirationFollowUpAnswers] =
    useState<InspirationFollowUpAnswers>({});

  const [pipelinePhase, setPipelinePhase] = useState<PipelinePhase>("idle");
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  /** Bumps when Kling submit finishes so VideoResultsPanel reloads task_ids from Supabase. */
  const [clipsRefreshNonce, setClipsRefreshNonce] = useState(0);

  /** Set once on mount when localStorage has a saved lazy session (refresh recovery). */
  const [restoredLazySessionId, setRestoredLazySessionId] = useState<string | null>(null);
  const [lazyStorageChecked, setLazyStorageChecked] = useState(false);

  /** Read live DOM before pipeline — fixes first-click no-op when controlled state lags (IME / autofill / paste). */
  const storyIdeaTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Per-template hidden file inputs; explicit click() is more reliable on mobile Safari. */
  const castUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const startNewLazySession = useCallback(() => {
    clearLazySessionFromStorage();
    setRestoredLazySessionId(null);
    setProjectId("");
    setPipelinePhase("idle");
    setPipelineError(null);
    setPipelineRunning(false);
    setClipsRefreshNonce(0);
    setInspirationFollowUpAnswers({});
  }, []);

  const composedInspiration = useMemo(
    () => composeInspirationForNel(storyIdea, inspirationFollowUpAnswers),
    [storyIdea, inspirationFollowUpAnswers],
  );

  /** Bumps on textarea input/composition so gate reads live DOM (fixes disabled button when state lags IME/paste). */
  const [storyFieldTick, setStoryFieldTick] = useState(0);

  const liveStoryForGate = useMemo(() => {
    void storyFieldTick;
    return storyIdeaTextareaRef.current?.value ?? storyIdea;
  }, [storyIdea, storyFieldTick]);

  const composedForGate = useMemo(
    () => composeInspirationForNel(liveStoryForGate, inspirationFollowUpAnswers),
    [liveStoryForGate, inspirationFollowUpAnswers],
  );

  const canRunDramaLive = useMemo(
    () =>
      liveStoryForGate.trim().length >= DIRECT_SCRIPT_MIN_CHARS ||
      composedForGate.trim().length >= 8,
    [liveStoryForGate, composedForGate],
  );

  const selectedTemplates = useMemo(
    () => templates.filter((tpl) => selectedTemplateIds.includes(tpl.id)),
    [templates, selectedTemplateIds],
  );
  const hasSelectedCast = selectedTemplates.length > 0;

  const allSelectedCastConfirmed = useMemo(() => {
    if (selectedTemplates.length === 0) return true;
    return selectedTemplates.every((tpl) => {
      const c = castConfirmations[tpl.id];
      if (!c) return false;
      if (c.choice === "template") return true;
      return !!c.file;
    });
  }, [selectedTemplates, castConfirmations]);

  const showInspirationFollowUps = useMemo(
    () => shouldShowInspirationFollowUps(composedInspiration, false),
    [composedInspiration],
  );
  const inspirationGenerateReady = useMemo(
    () => inspirationReadyForGenerate(composedInspiration),
    [composedInspiration],
  );

  const adjustStoryIdeaTextareaHeight = useCallback(() => {
    const el = storyIdeaTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(120, el.scrollHeight)}px`;
  }, []);

  useLayoutEffect(() => {
    adjustStoryIdeaTextareaHeight();
  }, [storyIdea, adjustStoryIdeaTextareaHeight]);

  const setInspirationFollowUpAnswer = useCallback(
    (dimension: keyof InspirationFollowUpAnswers, question: string, answer: string) => {
      setInspirationFollowUpAnswers((prev) => ({
        ...prev,
        [dimension]: { question, answer },
      }));
    },
    [],
  );

  useEffect(() => {
    if (storyIdea.trim().length === 0) {
      setInspirationFollowUpAnswers({});
    }
  }, [storyIdea]);

  useEffect(() => {
    setCastConfirmations((prev) => {
      const selected = new Set(selectedTemplateIds);
      const next: Record<string, CastConfirmation> = {};
      for (const [id, value] of Object.entries(prev)) {
        if (selected.has(id)) next[id] = value;
      }
      return next;
    });
  }, [selectedTemplateIds]);

  const runDramaPipeline = useCallback(async () => {
    console.log("[ScriptFlow] runDramaPipeline invoked", {
      pipelineRunning,
      allSelectedCastConfirmed,
      selectedTemplateCount: selectedTemplates.length,
    });

    const latestIdea = storyIdeaTextareaRef.current?.value ?? storyIdea;
    if (latestIdea !== storyIdea) {
      setStoryIdea(latestIdea);
    }

    const trimmedRaw = latestIdea.trim();
    const composedForRun = composeInspirationForNel(
      latestIdea,
      inspirationFollowUpAnswers,
    );
    const isDirectScript = trimmedRaw.length >= DIRECT_SCRIPT_MIN_CHARS;
    const canActuallyRun =
      isDirectScript || composedForRun.trim().length >= 8;
    if (!canActuallyRun) {
      setPipelineError(
        "Add a bit more detail (8+ characters), or paste a full script (50+ characters).",
      );
      return;
    }
    if (!allSelectedCastConfirmed) {
      setPipelineError("Please confirm your cast first");
      return;
    }

    setPipelineError(null);
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
      writeLazySessionIdToStorage(pid);

      activePhase = "analyzing_story";
      setPipelinePhase("analyzing_story");
      let nelScript: string;
      if (isDirectScript) {
        nelScript = trimmedRaw;
      } else {
        const fr = await formatStoryIdeaAction({
          idea: composedForRun.trim(),
        });
        if (!fr.success) throw new Error(errMsg(fr.error));
        nelScript = storyboardShotsToNelScriptText(fr.data.shots);
      }

      const ar = await analyzeScriptAction({
        projectId: pid,
        scriptText: nelScript,
        nelProfile: "lazy",
      });
      if (!ar.success) throw new Error(errMsg(ar.error));

      activePhase = "locking_characters";
      setPipelinePhase("locking_characters");
      const templateIdsToBind = selectedTemplates
        .filter((tpl) => {
          const c = castConfirmations[tpl.id];
          return c?.choice === "template";
        })
        .map((tpl) => tpl.id);

      if (templateIdsToBind.length > 0) {
        const br = await bindTemplateCharactersAction({
          projectId: pid,
          templateIds: templateIdsToBind,
        });
        if (!br.success) throw new Error(errMsg(br.error));
      }

      const toBase64 = async (file: File): Promise<string> => {
        const buf = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
      };

      for (const tpl of selectedTemplates) {
        const c = castConfirmations[tpl.id];
        if (c?.choice !== "upload" || !c.file) continue;
        const base64Data = await toBase64(c.file);
        const ur = await uploadCustomCharacterAction({
          projectId: pid,
          name: tpl.name,
          role: tpl.role,
          fileName: c.file.name || `${tpl.name}.jpg`,
          mimeType: c.file.type || "image/jpeg",
          base64Data,
        });
        if (!ur.success) throw new Error(errMsg(ur.error));
      }

      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      const gr = await generateKlingPromptsAction({ projectId: pid });
      if (!gr.success) throw new Error(errMsg(gr.error));

      activePhase = "submitting_kling";
      setPipelinePhase("submitting_kling");
      const sr = await submitKlingTasksAction({
        projectId: pid,
        prompts: gr.data.prompts,
      });
      if (!sr.success) throw new Error(errMsg(sr.error));
      const submittedIds = sr.data.tasks
        .map((t) => t.task_id.trim())
        .filter((id) => id.length > 0);
      writeKlingTaskSnapshotToStorage(pid, submittedIds);
      setClipsRefreshNonce((n) => n + 1);

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
    storyIdea,
    selectedTemplateIds,
    inspirationFollowUpAnswers,
    allSelectedCastConfirmed,
    selectedTemplates,
    castConfirmations,
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

  useEffect(() => {
    if (typeof window === "undefined") {
      setLazyStorageChecked(true);
      return;
    }
    const rawPrimary = window.localStorage.getItem(SCRIPTFLOW_SESSION_STORAGE_KEY);
    const id = readLazySessionIdFromStorage();
    // #17 debug: confirm mount read + key (check DevTools → Console)
    console.log("[ScriptFlow] session restore (mount)", {
      storageKey: SCRIPTFLOW_SESSION_STORAGE_KEY,
      rawPrimary,
      restoredSessionId: id,
    });
    if (id) {
      setRestoredLazySessionId(id);
      setProjectId(id);
    }
    setLazyStorageChecked(true);
  }, []);

  useEffect(() => {
    if (pipelinePhase === "done" && projectId.trim()) {
      writeLazySessionIdToStorage(projectId.trim());
      console.log("[ScriptFlow] session persist (pipeline done)", {
        storageKey: SCRIPTFLOW_SESSION_STORAGE_KEY,
        projectId: projectId.trim(),
      });
    }
  }, [pipelinePhase, projectId]);

  const showProgress = pipelinePhase !== "idle";
  const progressPct =
    pipelinePhase === "error" ? phaseProgress("submitting_kling") : phaseProgress(pipelinePhase);
  const canGenerate = canRunDramaLive && allSelectedCastConfirmed;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <nav
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-3"
          aria-label="Primary"
        >
          <div className="min-w-0 shrink text-xl font-extrabold tracking-tight">ScriptFlow</div>
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
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-12">
        <p className="text-sm text-white/60">从你的灵感，到你的短剧。</p>

        {!lazyStorageChecked ? (
          <p className="mt-10 text-center text-sm text-white/40">正在恢复会话…</p>
        ) : restoredLazySessionId ? (
          <>
            <section className="mt-8 rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-black/30 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-amber-400">已恢复上次生成</h2>
                  <p className="mt-1 max-w-xl text-xs text-white/50">
                    会话已保存在本机（痛点 #17）。将自动从 Supabase 拉取任务并轮询成片状态。
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-amber-500/45 text-amber-100 hover:bg-amber-500/15"
                  onClick={startNewLazySession}
                >
                  开始新项目
                </Button>
              </div>
            </section>
            <VideoResultsPanel
              sessionId={restoredLazySessionId}
              taskIds={[]}
              refreshNonce={clipsRefreshNonce}
              title="Your clips"
            />
          </>
        ) : (
          <>
        {/* —— Main lazy flow —— */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-amber-400">Your story</h2>
          <p className="mt-1 text-xs text-white/45">
            Optional cast, then one tap — we handle the rest.
          </p>

          <div className="mt-4 space-y-4">
            <label className="text-sm font-medium text-white/80" htmlFor="story-input">
              Story
            </label>
            <textarea
              id="story-input"
              ref={storyIdeaTextareaRef}
              value={storyIdea}
              onChange={(e) => {
                setStoryIdea(e.target.value);
                requestAnimationFrame(() => adjustStoryIdeaTextareaHeight());
              }}
              onInput={() => setStoryFieldTick((n) => n + 1)}
              onCompositionEnd={(e) => {
                setStoryIdea(e.currentTarget.value);
                setStoryFieldTick((n) => n + 1);
              }}
              rows={1}
              placeholder="Describe your story, or paste your full script — any length works."
              className="min-h-[120px] w-full resize-y overflow-hidden rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            />
            {showInspirationFollowUps && (
              <InspirationFollowUpCards
                storyIdeaRaw={storyIdea}
                answers={inspirationFollowUpAnswers}
                onSetAnswer={setInspirationFollowUpAnswer}
              />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-amber-400">Cast (optional)</h2>
          <p className="mt-1 text-xs text-white/45">
            Choose look templates, then confirm each selected role before generating.
          </p>
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
          {selectedTemplates.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-amber-200/90">
                Confirm each selected role: choose template look or upload your own photo.
              </p>
              {selectedTemplates.map((tpl) => {
                const c = castConfirmations[tpl.id];
                const confirmed = !!c && (c.choice === "template" || (c.choice === "upload" && !!c.file));
                return (
                  <div
                    key={`confirm-${tpl.id}`}
                    className={cn(
                      "rounded-xl border bg-zinc-950/70 p-3",
                      confirmed ? "border-emerald-500/40" : "border-amber-500/40",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveRenderableImageSrc(tpl.reference_image_url, CAST_IMAGE_PLACEHOLDER_URL)}
                        alt={tpl.label}
                        className="h-28 w-24 rounded-lg border border-white/10 object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.dataset.fallbackApplied === "1") return;
                          img.dataset.fallbackApplied = "1";
                          img.src = "https://placehold.co/240x320?text=Image+Unavailable";
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{tpl.label}</p>
                        <p className="mt-1 text-xs text-white/50">
                          {confirmed ? "Confirmed" : "Pending confirmation"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-medium",
                              c?.choice === "template"
                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                                : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
                            )}
                            onClick={() =>
                              setCastConfirmations((prev) => ({
                                ...prev,
                                [tpl.id]: { choice: "template" },
                              }))
                            }
                          >
                            Use this look
                          </button>
                          <button
                            type="button"
                            disabled={pipelineRunning || uploadingCastId === tpl.id}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-medium",
                              c?.choice === "upload"
                                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                                : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
                              (pipelineRunning || uploadingCastId === tpl.id) &&
                                "cursor-not-allowed opacity-50",
                            )}
                            onClick={() => {
                              if (pipelineRunning || uploadingCastId === tpl.id) return;
                              const input = castUploadInputRefs.current[tpl.id];
                              if (!input) return;
                              // Reset so selecting the same file still triggers onChange on iOS/desktop.
                              input.value = "";
                              input.click();
                            }}
                          >
                            Upload my own photo
                          </button>
                          <input
                            ref={(el) => {
                              castUploadInputRefs.current[tpl.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onClick={(e) => {
                              // Keeps change event firing when user picks the same image again.
                              e.currentTarget.value = "";
                            }}
                            onChange={(e) => {
                              setUploadingCastId(tpl.id);
                              const file = e.target.files?.[0];
                              try {
                                if (!file) return;
                                setCastConfirmations((prev) => ({
                                  ...prev,
                                  [tpl.id]: { choice: "upload", file },
                                }));
                              } finally {
                                e.currentTarget.value = "";
                                setUploadingCastId((prev) => (prev === tpl.id ? null : prev));
                              }
                            }}
                          />
                        </div>
                        {c?.choice === "upload" && (
                          <p className="mt-2 text-xs text-white/55">
                            {c.file ? `Uploaded: ${c.file.name}` : "Please upload a photo to confirm."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-black/40 p-6">
          <Button
            type="button"
            disabled={pipelineRunning || !canGenerate}
            className={cn(
              "h-12 w-full bg-amber-500 text-base font-semibold text-black transition-all hover:bg-amber-400 disabled:opacity-40",
              inspirationGenerateReady &&
                !pipelineRunning &&
                "ring-2 ring-amber-200 ring-offset-2 ring-offset-zinc-950 shadow-lg shadow-amber-500/25 hover:bg-amber-400",
            )}
            onPointerDown={() => {
              const el = storyIdeaTextareaRef.current;
              if (el && el.value !== storyIdea) {
                flushSync(() => setStoryIdea(el.value));
              }
            }}
            onClick={() => void runDramaPipeline()}
          >
            {pipelineRunning ? "Working on it…" : "Generate My Drama"}
          </Button>
          {!canRunDramaLive && !pipelineRunning && (
            <p className="mt-2 text-center text-xs text-white/40">
              Short ideas: add 8+ characters (use follow-up cards if shown). Long scripts: 50+
              characters skips formatting and goes straight to analysis.
            </p>
          )}
          {canRunDramaLive && hasSelectedCast && !allSelectedCastConfirmed && !pipelineRunning && (
            <p className="mt-2 text-center text-xs text-amber-200/90">
              Please confirm your cast first
            </p>
          )}
          {canRunDramaLive && !pipelineRunning && (
            <p
              className={cn(
                "mt-2 text-center text-xs",
                inspirationGenerateReady ? "text-amber-200/90" : "text-white/35",
              )}
            >
              {inspirationGenerateReady
                ? "灵感已够丰富 — Generate 已高亮，可一键开拍。"
                : "达到约 50 字并包含主角、矛盾与结局线索后，追问卡片会消失且按钮高亮。"}
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

          {pipelinePhase === "done" && (
            <VideoResultsPanel
              sessionId={projectId}
              taskIds={[]}
              refreshNonce={clipsRefreshNonce}
              title="Your clips"
            />
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
}
