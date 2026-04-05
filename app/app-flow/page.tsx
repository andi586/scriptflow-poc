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
import { ScriptFlowWaitingScreen } from "@/components/scriptflow-waiting-screen";

/** Pasted scripts at least this long skip idea→9-shot formatting and go straight to NEL. */
const DIRECT_SCRIPT_MIN_CHARS = 50;
const SCRIPTFLOW_PROJECT_ID_STORAGE_KEY = "scriptflow_project_id";
const LEGAL_CONSENT_STORAGE_KEY = "scriptflow_legal_consent_v1";

// ─── Chaos Spark ideas pool ───────────────────────────────────────────────────
const CHAOS_IDEAS = [
  {
    headline: "Your group chat is on alien trial",
    sub: "Everyone gets exposed. Nobody survives.",
  },
  {
    headline: "Your most innocent friend is the villain",
    sub: "The betrayal was always in the group.",
  },
  {
    headline: "You tried to enter Heaven, got rejected",
    sub: "Even the angels are tired of your drama.",
  },
  {
    headline: "Your friend is crowned King of Bad Decisions",
    sub: "Global ceremony. Nobody vetoed it.",
  },
  {
    headline: "Zombie outbreak. Your group are last survivors.",
    sub: "The zombie was already in the group chat.",
  },
  {
    headline: "Your squad accidentally started a cult",
    sub: "Nobody meant to. Everyone stayed.",
  },
  {
    headline: "Time loop. Only you remember.",
    sub: "Your friends keep making the same mistake.",
  },
];

function pickRandom3(arr: typeof CHAOS_IDEAS) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

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

// ─── Legal Consent Modal ──────────────────────────────────────────────────────
function LegalConsentModal({
  onAccept,
  onClose,
}: {
  onAccept: () => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-1">Before you upload 📋</h2>
        <p className="text-xs text-white/50 mb-4">By uploading photos, you confirm:</p>

        <ul className="space-y-3 mb-5">
          {[
            "You have the consent of every person whose photo you are uploading",
            "For minors under 18, you are their parent or legal guardian",
            "Photos used only to generate your video",
            "Photos deleted after 7 days",
            "No public figures or celebrities",
            "Content not used to defame or harm anyone",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/80">
              <span className="mt-0.5 text-amber-400 shrink-0">☑</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <label className="flex items-center gap-3 cursor-pointer mb-5 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="w-4 h-4 accent-amber-400"
          />
          <span className="text-sm font-medium text-white">I understand and agree</span>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/20 text-sm text-white/60 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!checked}
            onClick={() => {
              if (!checked) return;
              try { localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, "1"); } catch {}
              onAccept();
            }}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-semibold transition-all",
              checked
                ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300 shadow-lg shadow-amber-500/30"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            )}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Squad Modal (after first photo upload) ───────────────────────────────────
function SquadModal({
  onAddFriends,
  onJustMe,
  onUseIdea,
}: {
  onAddFriends: () => void;
  onJustMe: () => void;
  onUseIdea: (idea: string) => void;
}) {
  const [ideas] = useState(() => pickRandom3(CHAOS_IDEAS));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">🔥 Want more chaos?</h2>
        <p className="text-sm text-white/60 mb-5">
          Add up to 4 more friends —<br />
          we&apos;ll put them all in the movie.
        </p>

        <div className="space-y-3 mb-5">
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{idea.headline}</p>
                <p className="text-xs text-white/50 mt-0.5">{idea.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => onUseIdea(idea.headline)}
                className="shrink-0 rounded-lg border border-amber-500/60 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                Use this →
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAddFriends}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-sm mb-3 hover:from-amber-400 hover:to-yellow-300 shadow-lg shadow-amber-500/30 transition-all"
        >
          + Add Friends 📸
        </button>
        <button
          type="button"
          onClick={onJustMe}
          className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          No thanks, just me
        </button>
      </div>
    </div>
  );
}

// ─── Chaos Spark Bottom Sheet ─────────────────────────────────────────────────
function ChaosSparkSheet({
  onClose,
  onUseIdea,
}: {
  onClose: () => void;
  onUseIdea: (idea: string) => void;
}) {
  const [ideas, setIdeas] = useState(() => pickRandom3(CHAOS_IDEAS));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-2xl border-t border-white/15 bg-zinc-900 p-6 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        <h2 className="text-lg font-bold text-white mb-1">🔥 Pick your chaos</h2>
        <p className="text-sm text-white/50 mb-5">Steal one. Start the prank.</p>

        <div className="space-y-3 mb-5">
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{idea.headline}</p>
                <p className="text-xs text-white/50 mt-0.5">{idea.sub}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUseIdea(idea.headline);
                  onClose();
                }}
                className="shrink-0 rounded-lg border border-amber-500/60 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                Use this →
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIdeas(pickRandom3(CHAOS_IDEAS))}
          className="w-full py-3 rounded-xl border border-white/20 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
        >
          Shuffle ⚡
        </button>
      </div>
    </div>
  );
}

// ─── Cinematic Loading Animation ─────────────────────────────────────────────
function CinematicLoader() {
  const [step, setStep] = useState(0);
  const lines = ["Lights...", "Camera...", "Action..."];
  useEffect(() => {
    if (step >= lines.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      {lines.map((line, i) => (
        <p key={line} className={cn(
          "text-base font-bold tracking-widest transition-all duration-700",
          i < step ? "opacity-100 translate-y-0 text-amber-300" : "opacity-0 translate-y-2"
        )}>{line}</p>
      ))}
    </div>
  );
}

// ─── Star Mode: photo upload slots ───────────────────────────────────────────
type StarPhoto = {
  file: File;
  localUrl: string;
};

const MAX_STAR_PHOTOS = 10;

function isHeicFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

async function convertHeicToJpeg(file: File): Promise<File> {
  // Dynamic import to avoid SSR issues
  const heic2any = (await import("heic2any")).default;
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 }) as Blob;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

function StarModeUploader({
  photos,
  onPhotoAdded,
  onPhotoRemoved,
  onProceed,
  pipelineRunning,
}: {
  photos: StarPhoto[];
  onPhotoAdded: (file: File, index: number) => void;
  onPhotoRemoved: (index: number) => void;
  onProceed: () => void;
  pipelineRunning: boolean;
}) {
  // Dynamic slots: always show photos.length + 1 empty slot, capped at MAX_STAR_PHOTOS
  const totalSlots = Math.min(photos.length + 1, MAX_STAR_PHOTOS);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [convertingSlot, setConvertingSlot] = useState<number | null>(null);

  const slotLabel = (i: number) => {
    if (i === 0) return { icon: "📸", label: "#1 The Fate Writer ⭐" };
    return { icon: "+", label: `#${i + 1} Awaiting fate 🎭` };
  };

  const handleFileChange = async (file: File, index: number) => {
    let finalFile = file;
    console.log("[HEIC DEBUG] handleFileChange called, file:", file.name, file.type);
    if (isHeicFile(file)) {
      setConvertingSlot(index);
      try {
        finalFile = await convertHeicToJpeg(file);
      } catch (e) {
        console.warn("[HEIC] Conversion failed, using original:", e);
      } finally {
        setConvertingSlot(null);
      }
    }
    if (!isJpgPngWebpFile(finalFile) && !isHeicFile(file)) return;
    onPhotoAdded(finalFile, index);
  };

  return (
    <div className="mt-2 space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: totalSlots }).map((_, i) => {
          const photo = photos[i];
          const { icon, label } = slotLabel(i);
          const isConverting = convertingSlot === i;
          return (
            <div key={i} className="flex flex-col gap-1">
              {/* Slot number label above the card */}
              <p className={cn(
                "text-[10px] font-medium tracking-wide truncate",
                i === 0 ? "text-amber-300/70" : "text-white/30"
              )}>
                {i === 0 ? "#1 The Fate Writer ⭐" : `#${i + 1} Awaiting fate 🎭`}
              </p>
              <div className="relative aspect-[3/4]">
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.localUrl}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover rounded-xl border border-amber-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => onPhotoRemoved(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors"
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isConverting}
                    onClick={() => fileInputRefs.current[i]?.click()}
                    className={cn(
                      "w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                      i === 0
                        ? "border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-white/20 bg-white/3 hover:bg-white/5",
                      isConverting && "opacity-70 cursor-wait"
                    )}
                  >
                    {isConverting ? (
                      <span className="text-[9px] text-amber-300/80 text-center px-1 leading-tight">Converting photo...</span>
                    ) : (
                      <span className="text-2xl">{icon}</span>
                    )}
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[i] = el; }}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void handleFileChange(file, i);
                    }}
                  />
                </>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {photos.length > 0 && (
        <p className="text-xs text-white/40 text-center">
          {photos.length === 1
            ? "1 photo = just you"
            : `${photos.length} photos = squad mode 🔥`}
          {photos.length < MAX_STAR_PHOTOS && (
            <span className="ml-1 text-white/25">· max {MAX_STAR_PHOTOS}</span>
          )}
        </p>
      )}

      {photos.length > 0 && (
        <button
          type="button"
          disabled={pipelineRunning}
          onClick={onProceed}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-base hover:from-amber-400 hover:to-yellow-300 shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pipelineRunning ? "Working on it…" : "Generate My Movie ✨"}
        </button>
      )}
    </div>
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

  // ─── NEW UI STATE ──────────────────────────────────────────────────────────
  /** Which top-level mode the user chose: null = not chosen yet */
  const [entryMode, setEntryMode] = useState<"star" | "director" | null>("star");
  /** Show legal consent modal */
  const [showLegalModal, setShowLegalModal] = useState(false);
  /** Show squad upsell modal (after first photo) */
  const [showSquadModal, setShowSquadModal] = useState(false);
  /** Show chaos spark bottom sheet */
  const [showChaosSheet, setShowChaosSheet] = useState(false);
  /** Spark Chaos button flash animation */
  const [sparkFlash, setSparkFlash] = useState(false);
  /** Star mode photos */
  const [starPhotos, setStarPhotos] = useState<StarPhoto[]>([]);
  /** Whether to show extra 4 photo slots */
  const [showExtraSlots, setShowExtraSlots] = useState(false);
  /** Whether squad modal was already shown */
  const squadModalShownRef = useRef(false);
  // ──────────────────────────────────────────────────────────────────────────

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

  // Spark Chaos: flash button 2s after focus with no input
  const sparkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextareaFocus = useCallback(() => {
    if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
    sparkTimerRef.current = setTimeout(() => {
      const val = storyIdeaTextareaRef.current?.value ?? "";
      if (val.trim().length === 0) {
        setSparkFlash(true);
        setTimeout(() => setSparkFlash(false), 800);
      }
    }, 2000);
  }, []);

  const handleTextareaBlur = useCallback(() => {
    if (sparkTimerRef.current) clearTimeout(sparkTimerRef.current);
  }, []);

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
    setEntryMode(null);
    setStarPhotos([]);
    setShowExtraSlots(false);
    squadModalShownRef.current = false;
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

  // ─── Star Mode: handle photo added ────────────────────────────────────────
  const handleStarPhotoAdded = useCallback((file: File, index: number) => {
    const localUrl = URL.createObjectURL(file);
    setStarPhotos((prev) => {
      const next = [...prev];
      // Revoke old URL if replacing
      if (next[index]?.localUrl) URL.revokeObjectURL(next[index].localUrl);
      next[index] = { file, localUrl };
      return next;
    });

    // After first photo, show squad modal once
    if (index === 0 && !squadModalShownRef.current) {
      squadModalShownRef.current = true;
      setTimeout(() => setShowSquadModal(true), 400);
    }
  }, []);

  const handleStarPhotoRemoved = useCallback((index: number) => {
    setStarPhotos((prev) => {
      const next = [...prev];
      if (next[index]?.localUrl) URL.revokeObjectURL(next[index].localUrl);
      next.splice(index, 1);
      return next;
    });
  }, []);

  // ─── Be the Star: pipeline (uploads photos as character reference images) ──
  const runStarModePipeline = useCallback(async () => {
    const latestIdea = storyIdeaTextareaRef.current?.value ?? storyIdea;
    if (latestIdea !== storyIdea) setStoryIdea(latestIdea);

    if (starPhotos.length === 0) {
      setPipelineError("Upload at least 1 photo to generate.");
      return;
    }

    setPipelineError(null);
    setPipelineRunning(true);
    setLastSubmittedClipTaskIds([]);
    let activePhase: PipelinePhase = "creating_project";
    setPipelinePhase("creating_project");

    try {
      // 1. Create project
      const cr = await createNewProjectAction();
      if (!cr.success) throw new Error(errMsg(cr.error));
      const pid = cr.data.projectId;
      setProjectId(pid);
      setCurrentProjectId(pid);
      writeLazySessionIdToStorage(pid);
      try { window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, pid); } catch {}

      // 2. Upload star photos to Supabase storage and collect URLs
      const supabase = createClient();
      const uploadedUrls: string[] = [];
      for (let i = 0; i < starPhotos.length; i++) {
        const photo = starPhotos[i];
        try {
          const { blob, contentType } = await prepareImageForUpload(photo.file);
          const objectPath = `star-mode/${pid}/photo_${i}.${contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"}`;
          const { error: uploadError } = await supabase.storage
            .from("character-images")
            .upload(objectPath, blob, { contentType, upsert: true });
          if (uploadError) throw new Error(uploadError.message);
          const { data: pub } = supabase.storage.from("character-images").getPublicUrl(objectPath);
          if (pub.publicUrl) uploadedUrls.push(pub.publicUrl);
        } catch (e) {
          console.warn(`[StarMode] Failed to upload photo ${i}:`, e);
        }
      }

      // 3. Analyze story
      activePhase = "analyzing_story";
      setPipelinePhase("analyzing_story");
      const trimmedRaw = latestIdea.trim();
      const composedForRun = composeInspirationForNel(latestIdea, inspirationFollowUpAnswers);
      const isDirectScript = trimmedRaw.length >= DIRECT_SCRIPT_MIN_CHARS;
      let nelScript: string;
      if (isDirectScript) {
        nelScript = trimmedRaw;
      } else if (composedForRun.trim().length >= 8) {
        const fr = await formatStoryIdeaAction({ idea: composedForRun.trim() });
        if (!fr.success) throw new Error(errMsg(fr.error));
        nelScript = storyboardShotsToNelScriptText(fr.data.shots);
      } else {
        // No story text — use a default star-mode prompt
        nelScript = `A cinematic short film starring the uploaded characters. Make it dramatic and visually stunning.`;
      }

      const ar = await analyzeScriptAction({ projectId: pid, scriptText: nelScript, nelProfile: "lazy" });
      if (!ar.success) throw new Error(errMsg(ar.error));

      // 4. Attach uploaded photos as character reference images via API
      activePhase = "locking_characters";
      setPipelinePhase("locking_characters");
      if (uploadedUrls.length > 0) {
        try {
          await fetch("/api/projects/" + pid + "/star-photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoUrls: uploadedUrls }),
          });
        } catch (e) {
          console.warn("[StarMode] Failed to attach star photos:", e);
        }
      }

      // 5. Generate Kling prompts
      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      const gr = await generateKlingPromptsAction({ projectId: pid });
      if (!gr.success) throw new Error(errMsg(gr.error));

      // 6. Director review (same as drama pipeline)
      activePhase = "director_review";
      setPipelinePhase("director_review");
      setDirectorReviewPrompts(gr.data.prompts);
      setShowDirectorReview(true);
    } catch (e) {
      setPipelinePhase("error");
      const raw = e instanceof Error ? e.message : errMsg(e);
      setPipelineError(`${activePhase}: ${raw}`);
    } finally {
      setPipelineRunning(false);
    }
  }, [storyIdea, starPhotos, inspirationFollowUpAnswers]);

  // ─── Be the Star: check consent then proceed ───────────────────────────────
  const handleBeTheStar = useCallback(() => {
    try {
      const consented = localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY) === "1";
      if (consented) {
        setEntryMode("star");
      } else {
        setShowLegalModal(true);
      }
    } catch {
      setShowLegalModal(true);
    }
  }, []);

  // ─── Waiting screen visibility ────────────────────────────────────────────
  // Show the immersive waiting screen whenever the pipeline is actively running
  // (not idle, not error, not done, not director_review pause)
  const showWaitingScreen =
    pipelineRunning &&
    pipelinePhase !== "idle" &&
    pipelinePhase !== "error" &&
    pipelinePhase !== "director_review";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ─── ScriptFlow Immersive Waiting Screen ────────────────────────────── */}
      <ScriptFlowWaitingScreen
        phase={pipelinePhase}
        visible={showWaitingScreen}
      />

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}
      {showLegalModal && (
        <LegalConsentModal
          onAccept={() => {
            setShowLegalModal(false);
            setEntryMode("star");
          }}
          onClose={() => setShowLegalModal(false)}
        />
      )}

      {showSquadModal && (
        <SquadModal
          onAddFriends={() => {
            setShowSquadModal(false);
            setShowExtraSlots(true);
          }}
          onJustMe={() => {
            setShowSquadModal(false);
          }}
          onUseIdea={(idea) => {
            setStoryIdea(idea);
            if (storyIdeaTextareaRef.current) {
              storyIdeaTextareaRef.current.value = idea;
            }
            setShowSquadModal(false);
            setShowExtraSlots(true);
          }}
        />
      )}

      {showChaosSheet && (
        <ChaosSparkSheet
          onClose={() => setShowChaosSheet(false)}
          onUseIdea={(idea) => {
            setStoryIdea(idea);
            if (storyIdeaTextareaRef.current) {
              storyIdeaTextareaRef.current.value = idea;
              adjustStoryIdeaTextareaHeight();
            }
            setStoryFieldTick((n) => n + 1);
          }}
        />
      )}

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md">
        <nav
          className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-6 py-3"
          aria-label="Primary"
        >
          <a href="/" className="min-w-0 shrink text-xl font-extrabold tracking-tight text-white hover:text-[#D4A017] transition-colors flex items-center gap-2">← Heaven Cinema</a>
          <MyProjectsPanel onStartNew={startNewLazySession} />
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">

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
            {/* ═══════════════════════════════════════════════════════════════
                STEP 1: Hero Title
            ═══════════════════════════════════════════════════════════════ */}
            <div className="text-center pt-4 pb-8">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Direct Your Heaven.
              </h1>
              <p className="mt-3 text-base sm:text-lg text-white/50 font-light">
                One sentence. Your movie.
              </p>
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                STEP 2: Two Main Buttons (each expands inline with its own input)
            ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-8 mb-8">

              {/* ── Button 1: Be the Star ─────────────────────────────────── */}
              <div className={cn(
                "rounded-2xl transition-all duration-300",
                entryMode === "star"
                  ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 p-[2px] shadow-2xl shadow-amber-500/50"
                  : "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 p-[2px] shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/60"
              )}>
                <div className="rounded-2xl bg-gradient-to-b from-amber-500/20 to-black/80">
                  {/* Header row — always visible, click to toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (entryMode === "star") {
                        setEntryMode(null);
                      } else {
                        handleBeTheStar();
                      }
                    }}
                    className="w-full px-6 py-5 text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⭐</span>
                        <div>
                          <span className="text-xl font-extrabold text-white tracking-tight">Be the Star</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-amber-300 text-lg transition-transform duration-200",
                        entryMode === "star" ? "rotate-180" : ""
                      )}>▾</span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {entryMode === "star" && (
                    <div className="px-6 pb-6 space-y-4">
                      <p className="text-sm text-amber-200/70">Upload photos. Star in your story. &nbsp;<span className="text-white/30">1 photo = just you · 2–10 = squad</span></p>
                      <p className="text-xs text-white/35 -mt-2">Add friends. Make it chaos.</p>
                      {/* Photo upload slots */}
                      <StarModeUploader
                        photos={starPhotos}
                        onPhotoAdded={handleStarPhotoAdded}
                        onPhotoRemoved={handleStarPhotoRemoved}
                        onProceed={() => {}}
                        pipelineRunning={pipelineRunning}
                      />

                      {/* Story input */}
                      <div className="relative">
                        <textarea
                          id="story-input-star"
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
                          onFocus={handleTextareaFocus}
                          onBlur={handleTextareaBlur}
                          rows={3}
                          placeholder={"What happens to them?"}
                          className="min-h-[100px] w-full resize-none rounded-xl border border-amber-500/30 bg-black/60 px-4 py-3 pr-36 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 transition-all"
                        />
                        {/* Spark Chaos button — inset top-right */}
                        <button
                          type="button"
                          onClick={() => setShowChaosSheet(true)}
                          className={cn(
                            "absolute top-2 right-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                            "border-amber-500/50 bg-black/60 text-amber-400/80 hover:border-amber-400 hover:text-amber-300 hover:bg-amber-500/10",
                            sparkFlash && "animate-pulse border-amber-400 text-amber-300 shadow-md shadow-amber-500/40"
                          )}
                        >
                          Spark Chaos ⚡
                        </button>
                      </div>

                      {showInspirationFollowUps && (
                        <InspirationFollowUpCards
                          storyIdeaRaw={storyIdea}
                          answers={inspirationFollowUpAnswers}
                          onSetAnswer={setInspirationFollowUpAnswer}
                        />
                      )}

                      {/* Generate button */}
                      <button
                        type="button"
                        disabled={pipelineRunning || starPhotos.length === 0}
                        onPointerDown={() => {
                          const el = storyIdeaTextareaRef.current;
                          if (el && el.value !== storyIdea) {
                            flushSync(() => setStoryIdea(el.value));
                          }
                        }}
                        onClick={() => void runStarModePipeline()}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-base hover:from-amber-400 hover:to-yellow-300 shadow-lg shadow-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pipelineRunning ? "Working on it…" : "Make the Movie ✨"}
                      </button>

                      {starPhotos.length === 0 && (
                        <p className="text-center text-xs text-amber-200/60">Upload at least 1 photo to generate</p>
                      )}

                      {/* Error display only — progress is handled by ScriptFlowWaitingScreen */}
                      {pipelineError && (
                        <p className="text-center text-sm text-red-400" role="alert">
                          {pipelineError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Button 2: Be the Director ─────────────────────────────── */}
              <div className={cn(
                "rounded-2xl transition-all duration-300",
                entryMode === "director"
                  ? "bg-gradient-to-r from-slate-400 via-blue-200 to-slate-500 p-[2px] shadow-2xl shadow-blue-400/40"
                  : "bg-gradient-to-r from-slate-500 via-slate-300 to-slate-600 p-[2px] shadow-xl shadow-slate-500/25 hover:shadow-2xl hover:shadow-blue-300/40 hover:from-slate-400 hover:via-blue-200 hover:to-slate-500"
              )}>
                <div className="rounded-2xl bg-gradient-to-b from-slate-700/40 to-black/80">
                {/* Header row — always visible, click to toggle */}
                <button
                  type="button"
                  onClick={() => setEntryMode(entryMode === "director" ? null : "director")}
                  className="w-full px-6 py-5 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎬</span>
                      <div>
                        <span className="text-xl font-bold text-white tracking-tight">Be the Director</span>
                      </div>
                    </div>
                    <span className={cn(
                      "text-slate-300/60 text-lg transition-transform duration-200",
                      entryMode === "director" ? "rotate-180" : ""
                    )}>▾</span>
                  </div>
                </button>

                {/* Expanded content */}
                {entryMode === "director" && (
                  <div className="px-6 pb-6 space-y-4 border-t border-white/10 pt-4">
                <p className="text-sm text-slate-300/60">Write your story. Direct your vision.</p>

                {/* Story input — Director mode */}
                <div className="relative">
                  <textarea
                    id="story-input-director"
                    ref={entryMode === "director" ? storyIdeaTextareaRef : undefined}
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
                    rows={3}
                    placeholder="Describe your story..."
                    className="min-h-[100px] w-full resize-none rounded-xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/30 transition-all"
                  />
                </div>

                {showInspirationFollowUps && (
                  <InspirationFollowUpCards
                    storyIdeaRaw={storyIdea}
                    answers={inspirationFollowUpAnswers}
                    onSetAnswer={setInspirationFollowUpAnswer}
                  />
                )}

                {/* Cast section */}
                <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="text-sm font-semibold text-amber-400">Cast your characters</h2>
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

                {/* Generate buttons */}
                <div className="space-y-2">
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
                    {pipelineRunning && !directorModeActive ? "Working on it…" : "Make the Movie ✨"}
                  </Button>

                  {/* Director Mode button */}
                  <button
                    type="button"
                    disabled={pipelineRunning}
                    className="w-full py-3 border border-white text-white text-sm rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-center text-xs text-white/40">
                      Short ideas: add 8+ characters. Long scripts: 50+ characters skips formatting.
                    </p>
                  )}
                  {canRunDramaLive && hasSelectedCast && !allSelectedCastConfirmed && !pipelineRunning && (
                    <p className="text-center text-xs text-amber-200/90">
                      Please confirm your cast first
                    </p>
                  )}
                  {canRunDramaLive && !pipelineRunning && (
                    <p className={cn("text-center text-xs", inspirationGenerateReady ? "text-amber-200/90" : "text-white/35")}>
                      {inspirationGenerateReady
                        ? "Your idea is rich enough — Generate is highlighted, ready to shoot."
                        : "Add ~50 characters including protagonist, conflict, and resolution cues."}
                    </p>
                  )}
                </div>

                {/* Error display only — progress is handled by ScriptFlowWaitingScreen */}
                {pipelineError && (
                  <p className="text-center text-sm text-red-400" role="alert">
                    {pipelineError}
                  </p>
                )}

                  </div>
                )}
                </div>
              </div>

            </div>
            {/* ── End Two Main Buttons ─────────────────────────────────────── */}

            {/* ═══════════════════════════════════════════════════════════════
                DIRECTOR MODE: Review panels (outside the button card)
            ═══════════════════════════════════════════════════════════════ */}
            {showDirectorReview && (
              <section className="mt-6">
                <DirectorReviewPanel
                  key={directorReviewPrompts.length}
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

            {/* ── Director Mode: Script Review Panel (director-only) ─────────── */}
            {entryMode === "director" && showScriptReview && scriptReviewData && currentProjectId && (
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

            {/* ── Async render job progress panel (both modes) ──────────────── */}
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

            {/* ── Video results: Director Mode (directorModeActive) ─────────── */}
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

            {/* ── Video results: non-Director-Mode (Be the Star / Ghost Mode) ── */}
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
