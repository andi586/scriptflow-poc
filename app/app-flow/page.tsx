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
  listKlingTaskIdsForSessionAction,
  submitKlingTasksAction,
} from "@/actions/narrative.actions";
import { InspirationFollowUpCards } from "@/components/inspiration-follow-up-cards";
import { VideoResultsPanel } from "@/components/video-results-panel";
import { DirectorReviewPanel } from "@/components/director-review-panel";
import { ScriptReviewPanel } from "@/components/script-review-panel";
import { MyProjectsPanel } from "@/components/my-projects-panel";
import { RenderJobProgress } from "@/components/render-job-progress";
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
  listProjectCharacterImagesAction,
  listCharacterTemplatesAction,
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
import { prepareImageForUpload } from "@/lib/image-compress";
import { createClient } from "@/lib/supabase/client";
import { SellAsAssetButton } from "@/components/sell-as-asset-button";

/** Pasted scripts at least this long skip idea→9-shot formatting and go straight to NEL. */
const DIRECT_SCRIPT_MIN_CHARS = 50;
const SCRIPTFLOW_PROJECT_ID_STORAGE_KEY = "scriptflow_project_id";

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
  /** Blob URL for immediate card preview; revoked when replaced or cleared. */
  localPreviewUrl?: string;
  /** Persisted DB URL used after refresh; never revoked. */
  remotePreviewUrl?: string;
  /** `character_templates.id` (UUID from DB or built-in slug) for bindTemplateCharactersAction. */
  libraryTemplateId?: string;
};

type PipelinePhase =
  | "idle"
  | "creating_project"
  | "analyzing_story"
  | "locking_characters"
  | "generating_prompts"
  | "director_review"
  | "submitting_kling"
  | "done"
  | "error";
const CAST_IMAGE_PLACEHOLDER_URL = "https://placehold.co/240x320?text=No+Image";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function isJpgPngWebpFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(t)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function storageObjectFileName(originalName: string, contentType: string) {
  const stem = originalName
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return `${stem || "image"}.${ext}`;
}

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
  generating_prompts: "Preparing your scenes...",
  director_review: "Awaiting your review...",
  submitting_kling: "Generating your scenes...",
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
  const [directorReviewPrompts, setDirectorReviewPrompts] = useState<Array<{ prompt: string; [key: string]: any }>>([]);
  const [showDirectorReview, setShowDirectorReview] = useState(false);
  const [isSubmittingToKling, setIsSubmittingToKling] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Director Mode state
  const [directorModeActive, setDirectorModeActive] = useState(false);
  const [showScriptReview, setShowScriptReview] = useState(false);
  const [scriptReviewData, setScriptReviewData] = useState<{
    episode: any;
    characters: Array<{ name: string; description?: string }>;
    projectTitle?: string;
  } | null>(null);
  const [isSavingLines, setIsSavingLines] = useState(false);
  const [directorModeKlingPrompts, setDirectorModeKlingPrompts] = useState<Array<{ prompt: string; [key: string]: any }>>([]);
  /** Bumps when Kling submit finishes so VideoResultsPanel reloads task_ids from Supabase. */
  const [clipsRefreshNonce, setClipsRefreshNonce] = useState(0);
  /** PiAPI task ids from the last successful submit — keeps results panel visible before DB list catches up. */
  const [lastSubmittedClipTaskIds, setLastSubmittedClipTaskIds] = useState<string[]>([]);

  /** Set once on mount when localStorage has a saved lazy session (refresh recovery). */
  const [restoredLazySessionId, setRestoredLazySessionId] = useState<string | null>(null);
  const [lazyStorageChecked, setLazyStorageChecked] = useState(false);

  /** Async render job state — set after POST /api/render-jobs succeeds */
  const [activeRenderJobId, setActiveRenderJobId] = useState<string | null>(null);

  /** Read live DOM before pipeline — fixes first-click no-op when controlled state lags (IME / autofill / paste). */
  const storyIdeaTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Scroll results into view after pipeline completes (single-page flow; no separate /results route). */
  const clipsResultsSectionRef = useRef<HTMLElement | null>(null);
  /** Same pattern as /character-templates: one hidden input + rAF click (reliable file picker). */
  const castHomeFileInputRef = useRef<HTMLInputElement | null>(null);
  /** Which cast row is picking a file (mirrors uploadForId on character-templates page). */
  const [castUploadForTemplateId, setCastUploadForTemplateId] = useState<string | null>(null);
  /** Survives re-renders so file onChange always knows the row (avoids stale closure vs. separate preview state). */
  const castUploadPickTargetIdRef = useRef<string | null>(null);

  const startNewLazySession = useCallback(() => {
    console.log("[ScriptFlow] startNewLazySession triggered");
    clearLazySessionFromStorage();
    setRestoredLazySessionId(null);
    setProjectId("");
    setPipelinePhase("idle");
    setPipelineError(null);
    setPipelineRunning(false);
    setClipsRefreshNonce(0);
    setLastSubmittedClipTaskIds([]);
    setActiveRenderJobId(null);
    setCastConfirmations((prev) => {
      const next: Record<string, CastConfirmation> = {};
      for (const [id, v] of Object.entries(prev)) {
        if (v.localPreviewUrl) URL.revokeObjectURL(v.localPreviewUrl);
        next[id] =
          v.choice === "upload"
            ? { choice: "upload", file: v.file }
            : { choice: "template", libraryTemplateId: v.libraryTemplateId ?? id };
      }
      return next;
    });
    setCastUploadForTemplateId(null);
    castUploadPickTargetIdRef.current = null;
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
    if (selectedTemplateIds.length === 0) return true;
    return selectedTemplateIds.every((id) => {
      const c = castConfirmations[id];
      if (!c) return false;
      if (c.choice === "template") return true;
      return !!c.file;
    });
  }, [selectedTemplateIds, castConfirmations]);

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
        if (selected.has(id)) {
          next[id] = value;
        } else if (value.localPreviewUrl) {
          URL.revokeObjectURL(value.localPreviewUrl);
        }
      }
      return next;
    });
  }, [selectedTemplateIds]);

  useEffect(() => {
    setCastUploadForTemplateId((prev) =>
      prev && !selectedTemplateIds.includes(prev) ? null : prev,
    );
  }, [selectedTemplateIds]);

  // Director Mode pipeline: same as Ghost Mode but pauses after script gen for ScriptReviewPanel
  const runDirectorModePipeline = useCallback(async () => {
    const latestIdea = storyIdeaTextareaRef.current?.value ?? storyIdea;
    if (latestIdea !== storyIdea) setStoryIdea(latestIdea);

    const trimmedRaw = latestIdea.trim();
    const composedForRun = composeInspirationForNel(latestIdea, inspirationFollowUpAnswers);
    const isDirectScript = trimmedRaw.length >= DIRECT_SCRIPT_MIN_CHARS;
    const canActuallyRun = isDirectScript || composedForRun.trim().length >= 8;
    if (!canActuallyRun) {
      setPipelineError("Add a bit more detail (8+ characters), or paste a full script (50+ characters).");
      return;
    }
    if (!allSelectedCastConfirmed) {
      setPipelineError("Please confirm your cast first");
      return;
    }

    setPipelineError(null);
    setPipelineRunning(true);
    setDirectorModeActive(true);
    setShowScriptReview(false);
    setScriptReviewData(null);
    setLastSubmittedClipTaskIds([]);
    let activePhase: PipelinePhase = "creating_project";
    setPipelinePhase("creating_project");

    try {
      const cr = await createNewProjectAction();
      if (!cr.success) throw new Error(errMsg(cr.error));
      const pid = cr.data.projectId;
      setProjectId(pid);
      setCurrentProjectId(pid);
      writeLazySessionIdToStorage(pid);

      // Create async render job
      try {
        const jobRes = await fetch('/api/render-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pid }),
        });
        const jobData = await jobRes.json();
        if (jobData.jobId) {
        setActiveRenderJobId(jobData.jobId);
        try { window.localStorage.setItem('scriptflow_active_job_id', jobData.jobId); } catch {}
      }
      } catch (e) {
        console.warn('[render-job] Failed to create job:', e);
      }
      if (typeof window !== "undefined") {
        try { window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, pid); } catch {}
      }

      activePhase = "analyzing_story";
      setPipelinePhase("analyzing_story");
      let nelScript: string;
      if (isDirectScript) {
        nelScript = trimmedRaw;
      } else {
        const fr = await formatStoryIdeaAction({ idea: composedForRun.trim() });
        if (!fr.success) throw new Error(errMsg(fr.error));
        nelScript = storyboardShotsToNelScriptText(fr.data.shots);
      }

      const ar = await analyzeScriptAction({ projectId: pid, scriptText: nelScript, nelProfile: "lazy" });
      if (!ar.success) throw new Error(errMsg(ar.error));

      activePhase = "locking_characters";
      setPipelinePhase("locking_characters");
      const templateIdsToBind = selectedTemplateIds
        .filter((id) => castConfirmations[id]?.choice === "template")
        .map((id) => (castConfirmations[id]?.libraryTemplateId ?? id).trim())
        .filter(Boolean);
      if (templateIdsToBind.length > 0) {
        const br = await bindTemplateCharactersAction({ projectId: pid, templateIds: templateIdsToBind });
        if (!br.success) throw new Error(errMsg(br.error));
      }

      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      const gr = await generateKlingPromptsAction({ projectId: pid });
      if (!gr.success) throw new Error(errMsg(gr.error));

      // Fetch script_raw to populate ScriptReviewPanel
      const scriptRes = await fetch(`/api/projects/${pid}/script-raw`).catch(() => null);
      let episode: any = {};
      let characters: Array<{ name: string; description?: string }> = [];
      if (scriptRes?.ok) {
        const scriptData = await scriptRes.json().catch(() => ({}));
        const scriptRaw = scriptData.script_raw
          ? (typeof scriptData.script_raw === "string" ? JSON.parse(scriptData.script_raw) : scriptData.script_raw)
          : {};
        episode = scriptRaw?.structure?.episodes?.[0] ?? {};
        characters = (scriptRaw?.structure?.characters ?? []).map((c: any) => ({
          name: c.name ?? c.character ?? "",
          description: c.description ?? c.appearance ?? "",
        }));
      }

      // Pause here — show ScriptReviewPanel
      setDirectorModeKlingPrompts(gr.data.prompts);
      setScriptReviewData({ episode, characters, projectTitle: pid });
      setShowScriptReview(true);
      setPipelinePhase("director_review");
    } catch (e) {
      setPipelinePhase("error");
      const raw = e instanceof Error ? e.message : errMsg(e);
      setPipelineError(`${activePhase}: ${raw}`);
      setDirectorModeActive(false);
    } finally {
      setPipelineRunning(false);
    }
  }, [
    storyIdea, selectedTemplateIds, inspirationFollowUpAnswers,
    allSelectedCastConfirmed, castConfirmations,
  ]);

  // Director Mode: user confirmed edited lines → save → submit Kling
  const handleScriptReviewConfirm = useCallback(async (editedLines: Array<{ character: string; text: string }>) => {
    if (!currentProjectId) return;
    setIsSavingLines(true);
    try {
      // Save edited lines back to projects.script_raw
      const saveRes = await fetch("/api/script/update-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: currentProjectId, lines: editedLines }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to save edited lines");
      }

      // Now submit Kling tasks using the stored prompts
      setShowScriptReview(false);
      setIsSubmittingToKling(true);
      setPipelinePhase("submitting_kling");
      const sr = await submitKlingTasksAction({
        projectId: currentProjectId,
        prompts: directorModeKlingPrompts as any,
      });
      if (!sr.success) throw new Error(errMsg(sr.error));
      const submittedIds = sr.data.tasks
        .map((t: any) => t.task_id.trim())
        .filter((id: string) => id.length > 0);
      writeKlingTaskSnapshotToStorage(currentProjectId, submittedIds);
      setLastSubmittedClipTaskIds(submittedIds);
      setClipsRefreshNonce((n) => n + 1);
      setPipelinePhase("done");
    } catch (e) {
      setPipelinePhase("error");
      setPipelineError(e instanceof Error ? e.message : errMsg(e));
    } finally {
      setIsSavingLines(false);
      setIsSubmittingToKling(false);
    }
  }, [currentProjectId, directorModeKlingPrompts]);

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
    setLastSubmittedClipTaskIds([]);
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
      setCurrentProjectId(pid);
      writeLazySessionIdToStorage(pid);

      // Create async render job
      try {
        const jobRes = await fetch('/api/render-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pid }),
        });
        const jobData = await jobRes.json();
        if (jobData.jobId) {
        setActiveRenderJobId(jobData.jobId);
        try { window.localStorage.setItem('scriptflow_active_job_id', jobData.jobId); } catch {}
      }
      } catch (e) {
        console.warn('[render-job] Failed to create job:', e);
      }
      if (typeof window !== "undefined") {
        try {
          console.log("[project created] saving projectId to localStorage:", pid);
          window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, pid);
          console.log(
            "[project created] saved to localStorage:",
            window.localStorage.getItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY),
          );
        } catch {
          console.log("[project created] localStorage write failed");
        }
      }

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
      /** Bind by selected checkbox ids + stored library ids (not only templates still in current list). */
      const templateIdsToBind = selectedTemplateIds
        .filter((id) => castConfirmations[id]?.choice === "template")
        .map((id) => {
          const c = castConfirmations[id];
          const raw = (c?.libraryTemplateId ?? id).trim();
          return raw;
        })
        .filter(Boolean);

      if (templateIdsToBind.length > 0) {
        const br = await bindTemplateCharactersAction({
          projectId: pid,
          templateIds: templateIdsToBind,
        });
        if (!br.success) throw new Error(errMsg(br.error));
      }

      for (const id of selectedTemplateIds) {
        const c = castConfirmations[id];
        if (c?.choice !== "upload") continue;
        // Locking step only accepts persisted URLs to avoid oversized server-action payloads.
        if (!c.remotePreviewUrl) {
          throw new Error(
            "Uploaded cast image was not persisted yet. Please re-upload the photo and retry.",
          );
        }
      }

      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      const gr = await generateKlingPromptsAction({ projectId: pid });
      if (!gr.success) throw new Error(errMsg(gr.error));

      // Step 4: Director Review
      activePhase = "director_review";
      setPipelinePhase("director_review");
      setDirectorReviewPrompts(gr.data.prompts);
      setShowDirectorReview(true);
      return; // Pause pipeline, wait for director approval
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
    templates,
    castConfirmations,
  ]);

  async function handleDirectorApprove(editedPrompts: Array<{ prompt: string; [key: string]: any }>) {
    setIsSubmittingToKling(true);
    setShowDirectorReview(false);
    try {
      setPipelinePhase("submitting_kling");
      const sr = await submitKlingTasksAction({
        projectId: currentProjectId!,
        prompts: editedPrompts as any,
      });
      if (!sr.success) throw new Error(errMsg(sr.error));
      const submittedIds = sr.data.tasks
        .map((t: any) => t.task_id.trim())
        .filter((id: string) => id.length > 0);
      writeKlingTaskSnapshotToStorage(currentProjectId!, submittedIds);
      setLastSubmittedClipTaskIds(submittedIds);
      setClipsRefreshNonce((n) => n + 1);
      setPipelinePhase("done");
    } catch (e) {
      setPipelinePhase("error");
      const raw = e instanceof Error ? e.message : errMsg(e);
      setPipelineError(raw);
    } finally {
      setIsSubmittingToKling(false);
    }
  }

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
    if (!projectId.trim() || templates.length === 0) return;
    let cancelled = false;
    void (async () => {
      console.log("[fetchImages] calling with projectId:", projectId.trim());
      const res = await listProjectCharacterImagesAction({ projectId: projectId.trim() });
      console.log("[fetchImages] result:", res);
      if (cancelled || !res.success || res.data.items.length === 0) return;

      const byName = new Map(
        res.data.items.map((x) => [x.name.trim(), x.reference_image_url.trim()]),
      );
      const matchedTemplateIds = templates
        .filter((tpl) => byName.has(tpl.name.trim()))
        .map((tpl) => tpl.id);
      if (matchedTemplateIds.length === 0) return;

      setSelectedTemplateIds((prev) => [...new Set([...prev, ...matchedTemplateIds])]);
      setCastConfirmations((prev) => {
        const next = { ...prev };
        for (const tpl of templates) {
          const persisted = byName.get(tpl.name.trim());
          if (!persisted) continue;
          const existing = next[tpl.id];
          const templateUrl = resolveRenderableImageSrc(tpl.reference_image_url, "");
          const isTemplateImage = persisted === templateUrl;
          next[tpl.id] = {
            choice: isTemplateImage ? "template" : "upload",
            libraryTemplateId: tpl.id.trim(),
            file: existing?.file,
            localPreviewUrl: existing?.localPreviewUrl,
            remotePreviewUrl: persisted,
          };
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, templates]);

  useEffect(() => {
    // Fix: Always clear localStorage session on mount so users always see the
    // fresh input form when they navigate to /app-flow. Session restore was
    // causing mobile users to land directly on the "Previous session restored"
    // view instead of the Landing page experience.
    if (typeof window !== "undefined") {
      // Check if we're loading a specific project via URL param
      const urlParams = new URLSearchParams(window.location.search);
      const urlProjectId = urlParams.get('projectId');
      if (urlProjectId) {
        // Loading a specific project - set session and don't clear
        writeLazySessionIdToStorage(urlProjectId);
        try {
          window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, urlProjectId);
        } catch {}
        setRestoredLazySessionId(urlProjectId);
      } else {
        // Fresh visit - clear session
        clearLazySessionFromStorage();
        try {
          window.localStorage.removeItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY);
        } catch {}
      }
    }
    // Restore active render job from localStorage
    if (typeof window !== "undefined") {
      try {
        const savedJobId = window.localStorage.getItem('scriptflow_active_job_id');
        if (savedJobId) setActiveRenderJobId(savedJobId);
      } catch {}
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pid = projectId.trim();
    if (!pid) return;
    try {
      window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, pid);
      console.log(
        "[projectId effect] persisted projectId:",
        window.localStorage.getItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY),
      );
    } catch {
      console.log("[projectId effect] localStorage write failed");
    }
  }, [projectId]);

  /** Load PiAPI task_ids from kling_tasks for VideoResultsPanel (authoritative vs. submit response). */
  useEffect(() => {
    if (pipelinePhase !== "done" || !projectId.trim()) return;
    let cancelled = false;
    void (async () => {
      const res = await listKlingTaskIdsForSessionAction({ sessionId: projectId.trim() });
      if (cancelled) return;
      if (res.success && res.data.taskIds.length > 0) {
        setLastSubmittedClipTaskIds(res.data.taskIds);
        writeKlingTaskSnapshotToStorage(projectId.trim(), res.data.taskIds);
        setClipsRefreshNonce((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelinePhase, projectId]);

  useEffect(() => {
    const sid = restoredLazySessionId?.trim();
    if (!sid) return;
    let cancelled = false;
    void (async () => {
      const res = await listKlingTaskIdsForSessionAction({ sessionId: sid });
      if (cancelled) return;
      if (res.success && res.data.taskIds.length > 0) {
        setLastSubmittedClipTaskIds(res.data.taskIds);
        setClipsRefreshNonce((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoredLazySessionId]);

  useEffect(() => {
    if (pipelinePhase !== "done" || !projectId.trim()) return;
    const id = window.setTimeout(() => {
      clipsResultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(id);
  }, [pipelinePhase, projectId]);

  const showProgress = pipelinePhase !== "idle";
  const progressPct =
    pipelinePhase === "error" ? phaseProgress("submitting_kling") : phaseProgress(pipelinePhase);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <nav
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-3"
          aria-label="Primary"
        >
          <a href="/" className="min-w-0 shrink text-xl font-extrabold tracking-tight text-white hover:text-[#D4A017] transition-colors flex items-center gap-2">← Heaven Cinema</a>
          <MyProjectsPanel onStartNew={startNewLazySession} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8 sm:py-12">
        <p className="text-sm text-white/60">From your idea to your short drama.</p>

        {!lazyStorageChecked ? (
          <p className="mt-10 text-center text-sm text-white/40">Restoring session…</p>
        ) : restoredLazySessionId ? (
          <>
            <section className="mt-8 rounded-2xl border border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-black/30 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-amber-400">Previous session restored</h2>
                  <p className="mt-1 max-w-xl text-xs text-white/50">
                    Session ID: {restoredLazySessionId.slice(0, 8)}… · Pulling tasks from Supabase.
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 hover:border-white/60 active:scale-95 transition-all"
                  onClick={() => {
                    console.log("[ScriptFlow] Start new project button clicked");
                    startNewLazySession();
                  }}
                >
                  Start new project
                </button>
              </div>
            </section>
            <VideoResultsPanel
              sessionId={restoredLazySessionId}
              taskIds={lastSubmittedClipTaskIds}
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
              <input
                ref={castHomeFileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp,image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const templateId =
                    castUploadPickTargetIdRef.current ?? castUploadForTemplateId;
                  e.target.value = "";
                  castUploadPickTargetIdRef.current = null;
                  setCastUploadForTemplateId(null);
                  if (!file || !templateId) return;
                  if (!isJpgPngWebpFile(file)) return;

                  const tpl = templates.find((t) => t.id === templateId);
                  const isUuid =
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                      templateId,
                    );
                  setUploadingCastId(templateId);
                  void (async () => {
                    try {
                      setCastConfirmations((prev) => {
                        const prevEntry = prev[templateId];
                        if (prevEntry?.localPreviewUrl) {
                          URL.revokeObjectURL(prevEntry.localPreviewUrl);
                        }
                        const localPreviewUrl = URL.createObjectURL(file);
                        return {
                          ...prev,
                          [templateId]: {
                            choice: "upload",
                            file,
                            localPreviewUrl,
                            remotePreviewUrl: prevEntry?.remotePreviewUrl,
                            libraryTemplateId: templateId.trim(),
                          },
                        };
                      });

                      if (!isUuid) return;
                      const { blob, contentType } = await prepareImageForUpload(file);
                      const supabase = createClient();
                      const objectName = storageObjectFileName(`reference.${file.name}`, contentType);
                      const objectPath = `${templateId}/${objectName}`;
                      const { error: uploadError } = await supabase.storage
                        .from("character-images")
                        .upload(objectPath, blob, {
                          contentType,
                          upsert: true,
                        });
                      if (uploadError) throw new Error(uploadError.message);
                      const { data: pub } = supabase.storage.from("character-images").getPublicUrl(objectPath);
                      const url = pub.publicUrl;
                      if (!url) throw new Error("Could not get public URL for uploaded image");

                      const patchRes = await fetch(`/api/character-templates/${templateId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reference_image_url: url }),
                        cache: "no-store",
                      });
                      if (!patchRes.ok) {
                        const body = (await patchRes.json().catch(() => ({}))) as { error?: string };
                        throw new Error(body.error ?? `Update failed (${patchRes.status})`);
                      }

                      setTemplates((prev) =>
                        prev.map((t) =>
                          t.id === templateId ? { ...t, reference_image_url: url } : t,
                        ),
                      );
                      setCastConfirmations((prev) => {
                        const existing = prev[templateId];
                        if (!existing) return prev;
                        return {
                          ...prev,
                          [templateId]: {
                            ...existing,
                            choice: "upload",
                            remotePreviewUrl: url,
                          },
                        };
                      });
                    } catch (err) {
                      console.error("[ScriptFlow] immediate cast image persist failed", err);
                    } finally {
                      setUploadingCastId((prev) => (prev === templateId ? null : prev));
                    }
                  })();
                }}
              />
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-200">
                  ⚠️ <strong>For best results:</strong> Use a close-up portrait (face and shoulders only). Full-body photos reduce character consistency in video generation.
                </p>
              </div>
              <p className="text-xs text-amber-200/90">
                Confirm each selected role: choose template look or upload your own photo.
              </p>
              {selectedTemplates.map((tpl) => {
                const c = castConfirmations[tpl.id];
                const confirmed =
                  !!c &&
                  (c.choice === "template" ||
                    (c.choice === "upload" && (!!c.file || !!c.remotePreviewUrl)));
                const cardImageSrc =
                  c?.choice === "upload" && c.localPreviewUrl
                    ? c.localPreviewUrl
                    : c?.choice === "upload" && c.remotePreviewUrl
                      ? c.remotePreviewUrl
                    : resolveRenderableImageSrc(tpl.reference_image_url, CAST_IMAGE_PLACEHOLDER_URL);
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
                        key={c?.localPreviewUrl ?? c?.remotePreviewUrl ?? `${tpl.id}-${c?.choice}-ref`}
                        src={cardImageSrc}
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
                            onClick={() => {
                              setCastConfirmations((prev) => {
                                const cur = prev[tpl.id];
                                if (cur?.localPreviewUrl) {
                                  URL.revokeObjectURL(cur.localPreviewUrl);
                                }
                                return {
                                  ...prev,
                                  [tpl.id]: {
                                    choice: "template",
                                    libraryTemplateId: tpl.id.trim(),
                                  },
                                };
                              });
                            }}
                          >
                            Use this look
                          </button>
                          <button
                            type="button"
                            disabled={pipelineRunning || !!uploadingCastId}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-medium",
                              c?.choice === "upload"
                                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                                : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
                              (pipelineRunning || !!uploadingCastId) && "cursor-not-allowed opacity-50",
                            )}
                            onClick={() => {
                              if (pipelineRunning || uploadingCastId) return;
                              castUploadPickTargetIdRef.current = tpl.id;
                              requestAnimationFrame(() => castHomeFileInputRef.current?.click());
                            }}
                          >
                            Upload my own photo
                          </button>
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
            className={cn(
              "h-12 w-full bg-amber-500 text-base font-semibold text-black transition-all hover:bg-amber-400",
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
            {pipelineRunning && !directorModeActive ? "Working on it…" : "Generate My Drama"}
          </Button>

          {/* Director Mode button — always visible below main button */}
          <button
            type="button"
            disabled={pipelineRunning}
            className="w-full mt-2 py-3 border border-white text-white text-sm rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onPointerDown={() => {
              const el = storyIdeaTextareaRef.current;
              if (el && el.value !== storyIdea) {
                flushSync(() => setStoryIdea(el.value));
              }
            }}
            onClick={() => void runDirectorModePipeline()}
          >
            {pipelineRunning && directorModeActive ? "Working on it…" : "🎬 Director Mode — Review Each Step"}
          </button>
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
                ? "Your idea is rich enough — Generate is highlighted, ready to shoot."
                : "Add ~50 characters including protagonist, conflict, and resolution cues to unlock the button."}
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
                Creating project → Analyzing story → Locking characters → Preparing scenes →
                Generating your scenes
              </p>
              {(pipelinePhase === "generating_prompts" || pipelinePhase === "analyzing_story" || pipelinePhase === "locking_characters" || pipelinePhase === "creating_project" || pipelinePhase === "submitting_kling") && (
                <div className="mt-3 rounded-xl border border-orange-500/60 bg-orange-500/15 px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-orange-300">
                    ⚠️ Keep this page open — generating your scenes...
                  </p>
                  <p className="mt-1 text-xs text-orange-200/70">
                    Do not switch tabs or close this window.
                  </p>
                </div>
              )}
            </div>
          )}

          {pipelineError && (
            <p className="mt-4 text-center text-sm text-red-400" role="alert">
              {pipelineError}
            </p>
          )}

        </section>

        {showDirectorReview && (
          <section className="mt-6">
            <DirectorReviewPanel
              prompts={directorReviewPrompts}
              onApprove={handleDirectorApprove}
              onCancel={() => {
                setShowDirectorReview(false);
                setPipelinePhase("idle");
              }}
              isSubmitting={isSubmittingToKling}
            />
          </section>
        )}

        {/* Director Mode: Script Review Panel */}
        {showScriptReview && scriptReviewData && currentProjectId && (
          <section className="mt-6">
            <ScriptReviewPanel
              projectId={currentProjectId}
              projectTitle={scriptReviewData.projectTitle}
              episode={scriptReviewData.episode}
              characters={scriptReviewData.characters}
              isSaving={isSavingLines || isSubmittingToKling}
              onConfirm={(editedLines) => void handleScriptReviewConfirm(editedLines)}
              onStartOver={() => {
                setShowScriptReview(false);
                setScriptReviewData(null);
                setDirectorModeActive(false);
                setPipelinePhase("idle");
                setPipelineError(null);
              }}
            />
          </section>
        )}

        {/* Director Mode: show clips after Kling submit */}
        {directorModeActive && pipelinePhase === "done" && currentProjectId && (
          <section
            ref={clipsResultsSectionRef}
            className="mt-8 scroll-mt-24 rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-500/10 to-black/30 p-6"
            aria-labelledby="director-clips-heading"
          >
            <h2 id="director-clips-heading" className="text-base font-semibold text-emerald-300">
              Your clips
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Sit back and relax — we'll notify you when your episode is ready.
            </p>
            <VideoResultsPanel
              sessionId={currentProjectId}
              taskIds={lastSubmittedClipTaskIds}
              refreshNonce={clipsRefreshNonce}
              title="Scenes"
            />
          </section>
        )}

        {/* Async render job progress panel */}
        {activeRenderJobId && (
          <section className="mt-6">
            <RenderJobProgress
              jobId={activeRenderJobId}
              onComplete={(finalVideoUrl, taskIds) => {
                if (taskIds.length > 0) {
                  setLastSubmittedClipTaskIds(taskIds);
                  setClipsRefreshNonce((n) => n + 1);
                }
                setPipelinePhase("done");
              }}
              onFailed={(error) => {
                setPipelineError(error);
                setPipelinePhase("error");
              }}
              onStartOver={startNewLazySession}
            />
          </section>
        )}

        {pipelinePhase === "done" && projectId.trim() && !directorModeActive && (
          <section
            ref={clipsResultsSectionRef}
            className="mt-8 scroll-mt-24 rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-500/10 to-black/30 p-6"
            aria-labelledby="clips-results-heading"
          >
            <h2 id="clips-results-heading" className="text-base font-semibold text-emerald-300">
              Your clips
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Sit back and relax — we'll notify you when your episode is ready.
            </p>
            <VideoResultsPanel
              sessionId={projectId}
              taskIds={lastSubmittedClipTaskIds}
              refreshNonce={clipsRefreshNonce}
              title="Scenes"
            />

            {/* Cinema Bazaar: Sell as Asset */}
            <SellAsAssetButton projectId={projectId} />
          </section>
        )}
          </>
        )}
      </main>
    </div>
  );
}
