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

// ─── Camera Preview ───────────────────────────────────────────────────────────
function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((e) => {
        setCameraError(e instanceof Error ? e.message : "Camera unavailable");
      });
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10">
      {cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-white/40 text-center px-4">{cameraError}</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
      )}
    </div>
  );
}

// ─── Record Button with segmented captions ────────────────────────────────────
function RecordButton({
  pipelineRunning,
  starPhotos,
  onPhotoAdded,
  onPhotoRemoved,
  currentProjectId,
  onVoiceCloned,
  onRecord,
}: {
  pipelineRunning: boolean;
  starPhotos: StarPhoto[];
  onPhotoAdded: (file: File, index: number) => void;
  onPhotoRemoved: (index: number) => void;
  currentProjectId: string | null;
  onVoiceCloned: (voiceId: string) => void;
  onRecord: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "processing" | "done" | "error">("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CAPTIONS = [
    { from: 0, to: 10, text: "Show your face..." },
    { from: 10, to: 20, text: "Now show your world..." },
    { from: 20, to: 30, text: "Keep going..." },
  ];

  const currentCaption = CAPTIONS.find(
    (c) => recordingSeconds >= c.from && recordingSeconds < c.to
  )?.text ?? "";

  const startRecording = async () => {
    setRecordingError(null);
    setRecordingStatus("recording");
    setIsRecording(true);
    setRecordingSeconds(0);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setRecordingStatus("processing");

        try {
          const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
          const videoUrl = URL.createObjectURL(videoBlob);
          const video = document.createElement("video");
          video.src = videoUrl;
          video.muted = true;
          video.playsInline = true;
          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve();
            video.onerror = () => reject(new Error("Failed to load video"));
            video.load();
          });
          video.currentTime = 0;
          await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unavailable");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(videoUrl);
          const frameBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", 0.92);
          });
          const frameFile = new File([frameBlob], "recording_frame.jpg", { type: "image/jpeg" });

          // Upload to Supabase
          const supabase = createClient();
          const ts = Date.now();
          const framePath = `star-mode/recordings/${ts}_frame.jpg`;
          await supabase.storage.from("character-images").upload(framePath, frameBlob, { contentType: "image/jpeg", upsert: true });

          const videoExt = mimeType.includes("mp4") ? "mp4" : "webm";
          const videoPath = `star-mode/recordings/${ts}_recording.${videoExt}`;
          const { error: vidErr } = await supabase.storage.from("character-images").upload(videoPath, videoBlob, { contentType: mimeType, upsert: true });

          if (!vidErr) {
            const { data: pub } = supabase.storage.from("character-images").getPublicUrl(videoPath);
            if (pub?.publicUrl) {
              void (async () => {
                try {
                  const res = await fetch("/api/voice-clone", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ audioUrl: pub.publicUrl, projectId: currentProjectId }),
                  });
                  const data = await res.json() as { ok?: boolean; voice_id?: string; success?: boolean };
                  const vid = data.voice_id;
                  if (vid) onVoiceCloned(vid);
                } catch {}
              })();
            }
          }

          onPhotoAdded(frameFile, starPhotos.length);
          setRecordingStatus("done");
        } catch (e) {
          setRecordingError(e instanceof Error ? e.message : "Processing failed");
          setRecordingStatus("error");
        }
      };

      recorder.start(100);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }, 30000);
    } catch (e) {
      setIsRecording(false);
      setRecordingError(e instanceof Error ? e.message : "Camera unavailable");
      setRecordingStatus("error");
    }
  };

  const stopRecording = () => {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-6">
      {/* Segmented caption */}
      {isRecording && currentCaption && (
        <p className="text-sm text-white/60 tracking-wide animate-pulse">{currentCaption}</p>
      )}

      {/* Record / Stop button */}
      <button
        type="button"
        disabled={recordingStatus === "processing" || pipelineRunning}
        onClick={isRecording ? stopRecording : () => void startRecording()}
        className={cn(
          "flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold transition-all",
          isRecording
            ? "bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/40"
            : recordingStatus === "done"
            ? "bg-emerald-600 text-white"
            : "bg-white text-black hover:bg-white/90 shadow-lg"
        )}
      >
        {isRecording ? (
          <>⏹ Stop</>
        ) : recordingStatus === "processing" ? (
          <>⏳ Processing…</>
        ) : recordingStatus === "done" ? (
          <>✓ Recorded</>
        ) : (
          <>● Record</>
        )}
      </button>

      {recordingError && (
        <p className="text-xs text-red-400">{recordingError}</p>
      )}

      {/* After recording: show Make Movie button */}
      {recordingStatus === "done" && starPhotos.length > 0 && (
        <button
          type="button"
          disabled={pipelineRunning}
          onClick={onRecord}
          className="mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-8 py-3 text-base font-bold text-black shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-300 transition-all disabled:opacity-50"
        >
          {pipelineRunning ? "Working on it…" : "Make the Movie ✨"}
        </button>
      )}
    </div>
  );
}

function StarModeUploader({
  photos,
  onPhotoAdded,
  onPhotoRemoved,
  onProceed,
  pipelineRunning,
  pendingProjectId,
  onVoiceCloned,
}: {
  photos: StarPhoto[];
  onPhotoAdded: (file: File, index: number) => void;
  onPhotoRemoved: (index: number) => void;
  onProceed: () => void;
  pipelineRunning: boolean;
  /** Project ID to associate the cloned voice with (may be null before project is created) */
  pendingProjectId?: string | null;
  /** Called with the ElevenLabs voice_id after successful cloning */
  onVoiceCloned?: (voiceId: string) => void;
}) {
  // Dynamic slots: always show photos.length + 1 empty slot, capped at MAX_STAR_PHOTOS
  const totalSlots = Math.min(photos.length + 1, MAX_STAR_PHOTOS);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [convertingSlot, setConvertingSlot] = useState<number | null>(null);

  // ─── Video recording state ────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "processing" | "done" | "error">("idle");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startRecording = async () => {
    setRecordingError(null);
    setRecordingStatus("recording");
    setIsRecording(true);
    recordedChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setRecordingStatus("processing");

        try {
          const videoBlob = new Blob(recordedChunksRef.current, { type: mimeType });

          // ── Extract first frame via canvas ──────────────────────────────
          const videoUrl = URL.createObjectURL(videoBlob);
          const video = document.createElement("video");
          video.src = videoUrl;
          video.muted = true;
          video.playsInline = true;

          await new Promise<void>((resolve, reject) => {
            video.onloadeddata = () => resolve();
            video.onerror = () => reject(new Error("Failed to load video for frame extraction"));
            video.load();
          });

          video.currentTime = 0;
          await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
          });

          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(videoUrl);

          const frameBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error("Canvas toBlob failed"));
            }, "image/jpeg", 0.92);
          });

          const frameFile = new File([frameBlob], "recording_frame.jpg", { type: "image/jpeg" });

          // ── Upload frame + audio to Supabase ────────────────────────────
          const supabase = createClient();
          const timestamp = Date.now();

          // Upload frame image
          const framePath = `star-mode/recordings/${timestamp}_frame.jpg`;
          const { error: frameUploadError } = await supabase.storage
            .from("character-images")
            .upload(framePath, frameBlob, { contentType: "image/jpeg", upsert: true });
          if (frameUploadError) throw new Error(`Frame upload failed: ${frameUploadError.message}`);

          // Upload audio/video blob
          const videoExt = mimeType.includes("mp4") ? "mp4" : "webm";
          const videoPath = `star-mode/recordings/${timestamp}_recording.${videoExt}`;
          const { error: videoUploadError } = await supabase.storage
            .from("character-images")
            .upload(videoPath, videoBlob, { contentType: mimeType, upsert: true });
          if (videoUploadError) {
            console.warn("[Recording] Video upload failed (non-fatal):", videoUploadError.message);
          }

          // ── Voice cloning: call server-side API with the uploaded audio URL ──
          // Only attempt if video upload succeeded and we have a projectId
          if (!videoUploadError) {
            const { data: videoPub } = supabase.storage
              .from("character-images")
              .getPublicUrl(videoPath);
            const audioPublicUrl = videoPub?.publicUrl;

            if (audioPublicUrl && onVoiceCloned) {
              // Fire-and-forget: clone voice in background, non-blocking
              void (async () => {
                try {
                  const cloneRes = await fetch("/api/voice-clone", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ audioUrl: audioPublicUrl, projectId: pendingProjectId }),
                  });
                  const cloneData = await cloneRes.json() as { ok: boolean; voiceId?: string; error?: string };
                  if (cloneData.ok && cloneData.voiceId) {
                    console.log("[Recording] Voice cloned:", cloneData.voiceId);
                    onVoiceCloned(cloneData.voiceId);
                  } else {
                    console.warn("[Recording] Voice clone failed (non-fatal):", cloneData.error);
                  }
                } catch (e) {
                  console.warn("[Recording] Voice clone request failed (non-fatal):", e);
                }
              })();
            }
          }

          // Add frame as a photo slot
          const nextIndex = photos.length;
          onPhotoAdded(frameFile, nextIndex);

          setRecordingStatus("done");
        } catch (e) {
          console.error("[Recording] Processing failed:", e);
          setRecordingError(e instanceof Error ? e.message : "Recording processing failed");
          setRecordingStatus("error");
        }
      };

      recorder.start(100); // collect data every 100ms

      // Auto-stop after 30 seconds
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    } catch (e) {
      console.error("[Recording] Failed to start:", e);
      setIsRecording(false);
      setRecordingError(e instanceof Error ? e.message : "Could not access camera/microphone");
      setRecordingStatus("error");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

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

      {/* ─── Record yourself button ──────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : () => void startRecording()}
          disabled={recordingStatus === "processing"}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
            isRecording
              ? "border-red-500/60 bg-red-500/15 text-red-300 hover:bg-red-500/25 animate-pulse"
              : recordingStatus === "processing"
              ? "border-white/20 bg-white/5 text-white/40 cursor-wait"
              : "border-white/25 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/40"
          )}
        >
          {isRecording ? (
            <>⏹ Stop recording</>
          ) : recordingStatus === "processing" ? (
            <>⏳ Processing…</>
          ) : (
            <>🎬 Record yourself (30s)</>
          )}
        </button>
        {isRecording && (
          <span className="text-xs text-red-400/80 animate-pulse">● Recording…</span>
        )}
        {recordingStatus === "done" && !isRecording && (
          <span className="text-xs text-emerald-400/80">✓ Frame captured!</span>
        )}
      </div>

      {recordingError && (
        <p className="text-xs text-red-400">{recordingError}</p>
      )}

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

  // ─── Director Mode: series settings ──────────────────────────────────────
  const [directorSeriesName, setDirectorSeriesName] = useState("");
  const [directorEpisodeNum, setDirectorEpisodeNum] = useState<number | null>(null);

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

      // Save series settings to project (if user filled them in)
      if (directorSeriesName.trim() || directorEpisodeNum !== null) {
        try {
          await fetch(`/api/projects/${pid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              series_name: directorSeriesName.trim() || null,
              episode_number: directorEpisodeNum,
            }),
          });
        } catch (e) {
          console.warn('[DirectorMode] Failed to save series settings:', e);
        }
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
    allSelectedCastConfirmed, castConfirmations, directorSeriesName, directorEpisodeNum,
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

  // ─── Star Mode: saved photos (localStorage) ───────────────────────────────
  const STAR_SAVED_PHOTOS_KEY = "scriptflow_star_saved_photo_urls";
  const [savedPhotoUrls, setSavedPhotoUrls] = useState<string[]>([]);
  const [showSavedPhotosPrompt, setShowSavedPhotosPrompt] = useState(false);

  // Load saved photo URLs on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAR_SAVED_PHOTOS_KEY);
      if (raw) {
        const urls: string[] = JSON.parse(raw);
        if (Array.isArray(urls) && urls.length > 0) {
          setSavedPhotoUrls(urls);
          setShowSavedPhotosPrompt(true);
        }
      }
    } catch {}
  }, []);

  // ─── Star Mode: translation state ─────────────────────────────────────────
  const [translatedToEnglish, setTranslatedToEnglish] = useState(false);

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

  // ─── Be the Star: duration tier ──────────────────────────────────────────
  type StarDurationTier = "taste" | "moment" | "full";
  const [starDurationTier, setStarDurationTier] = useState<StarDurationTier>("moment");

  // ─── Be the Star: Cinema Glow™ beauty tier ───────────────────────────────
  type CinemaGlowTier = "natural" | "cinema" | "iconic";
  const [cinemaGlowTier, setCinemaGlowTier] = useState<CinemaGlowTier>("cinema");
  const CINEMA_GLOW_OPTIONS: Array<{
    id: CinemaGlowTier;
    icon: string;
    label: string;
  }> = [
    { id: "natural", icon: "✨", label: "Natural" },
    { id: "cinema",  icon: "🎬", label: "Cinema"  },
    { id: "iconic",  icon: "👑", label: "Iconic"  },
  ];
  const STAR_DURATION_OPTIONS: Array<{
    id: StarDurationTier;
    icon: string;
    label: string;
    sub: string;
    maxScenes: number;
  }> = [
    { id: "taste",  icon: "⚡", label: "Taste of Fame",       sub: "~30s", maxScenes: 3 },
    { id: "moment", icon: "🎬", label: "My Moment",           sub: "~60s", maxScenes: 5 },
    { id: "full",   icon: "🎭", label: "Full Star Treatment", sub: "~90s", maxScenes: 8 },
  ];

  // ─── Be the Star: estimated wait time ────────────────────────────────────
  const [starEstimatedMinutes, setStarEstimatedMinutes] = useState<number | null>(null);

  // ─── Be the Star: character keyframe preview ──────────────────────────────
  const [starKeyframeUrl, setStarKeyframeUrl] = useState<string | null>(null);

  // ─── Be the Star: pipeline (uploads photos, auto-submits Kling, zero interruption) ──
  const runStarModePipeline = useCallback(async () => {
    const latestIdea = storyIdeaTextareaRef.current?.value ?? storyIdea;
    if (latestIdea !== storyIdea) setStoryIdea(latestIdea);

    if (starPhotos.length === 0) {
      setPipelineError("Upload at least 1 photo to generate.");
      return;
    }

    setPipelineError(null);
    setDirectorModeActive(false);
    setPipelineRunning(true);
    setLastSubmittedClipTaskIds([]);
    setStarEstimatedMinutes(null);
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

      // Mark this project as Star Mode so finalize pipeline skips episode title cards
      try {
        await fetch(`/api/projects/${pid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_star_mode: true }),
        });
      } catch (e) {
        console.warn('[StarMode] Failed to set is_star_mode flag:', e);
      }

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

      // Save uploaded URLs to localStorage for next-session recall
      if (uploadedUrls.length > 0) {
        try { localStorage.setItem(STAR_SAVED_PHOTOS_KEY, JSON.stringify(uploadedUrls)); } catch {}
      }

      // 3. Analyze story — auto-translate non-English input to English
      activePhase = "analyzing_story";
      setPipelinePhase("analyzing_story");
      const trimmedRaw = latestIdea.trim();
      const composedForRun = composeInspirationForNel(latestIdea, inspirationFollowUpAnswers);

      // Detect non-English: if text contains CJK or other non-ASCII chars, translate via Claude
      const hasNonEnglish = /[\u0080-\uFFFF]/.test(trimmedRaw) || /[\u0080-\uFFFF]/.test(composedForRun);
      let storyForNel = composedForRun.trim().length >= 8 ? composedForRun.trim() : trimmedRaw;

      // Detect language code from input text (simple heuristic)
      const detectedLang = (() => {
        const t = storyForNel;
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(t)) return 'zh';
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(t)) return 'ja';
        if (/[\uac00-\ud7af]/.test(t)) return 'ko';
        if (/[\u0600-\u06ff]/.test(t)) return 'ar';
        if (/[\u0900-\u097f]/.test(t)) return 'hi';
        if (/[\u0e00-\u0e7f]/.test(t)) return 'th';
        if (/[\u00c0-\u024f]/.test(t)) return 'es'; // rough Latin extended → Spanish/French/etc
        return 'en';
      })();

      // Save detected language to project so finalize pipeline can use it for TTS + subtitles
      if (detectedLang !== 'en') {
        try {
          await fetch(`/api/projects/${pid}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: detectedLang }),
          });
          console.log('[StarMode] Saved language to project:', detectedLang);
        } catch (e) {
          console.warn('[StarMode] Failed to save language:', e);
        }
      }

      if (hasNonEnglish && storyForNel.trim().length > 0) {
        try {
          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: storyForNel }),
          });
          if (translateRes.ok) {
            const { translated } = await translateRes.json() as { translated?: string };
            if (translated && translated.trim().length > 0) {
              storyForNel = translated.trim();
              setTranslatedToEnglish(true);
            }
          }
        } catch (e) {
          console.warn("[StarMode] Translation failed, using original:", e);
        }
      }

      const isDirectScript = storyForNel.length >= DIRECT_SCRIPT_MIN_CHARS;
      let nelScript: string;
      if (isDirectScript) {
        nelScript = storyForNel;
      } else if (storyForNel.trim().length >= 8) {
        const fr = await formatStoryIdeaAction({ idea: storyForNel.trim() });
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

        // character_templates insert is now handled by the star-photos API route
        // (which uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS).
        // The client-side anon key was silently blocked by RLS — removed.
        console.log(`[StarMode] character_templates insert delegated to /api/projects/${pid}/star-photos`);
      }

      // 5. Verify script_raw and beats exist in DB before generating prompts
      //    If missing, re-run analyzeScriptAction to ensure they are written.
      activePhase = "generating_prompts";
      setPipelinePhase("generating_prompts");
      try {
        const verifyRes = await fetch(`/api/projects/${pid}/script-raw`).catch(() => null);
        if (verifyRes?.ok) {
          const verifyData = await verifyRes.json().catch(() => ({})) as { script_raw?: unknown };
          const script_raw = verifyData.script_raw ?? null;
          console.log('[pipeline] script_raw:', script_raw);

          // Check beats in story_memory via a separate endpoint
          const smRes = await fetch(`/api/projects/${pid}/story-memory`).catch(() => null);
          let beats: unknown[] = [];
          if (smRes?.ok) {
            const smData = await smRes.json().catch(() => ({})) as { beats?: unknown[] };
            beats = Array.isArray(smData.beats) ? smData.beats : [];
          }
          console.log('[pipeline] beats:', beats);

          if (!script_raw || beats.length === 0) {
            console.warn('[pipeline] script_raw or beats missing — re-running analyzeScriptAction');
            const reAnalyze = await analyzeScriptAction({ projectId: pid, scriptText: nelScript, nelProfile: "lazy" });
            if (!reAnalyze.success) {
              console.error('[pipeline] re-analyze failed:', errMsg(reAnalyze.error));
            } else {
              console.log('[pipeline] re-analyze succeeded');
            }
          }
        }
      } catch (verifyErr) {
        console.warn('[pipeline] script_raw/beats verification failed (non-fatal):', verifyErr);
      }

      const selectedTier = STAR_DURATION_OPTIONS.find((o) => o.id === starDurationTier) ?? STAR_DURATION_OPTIONS[1];
      const gr = await generateKlingPromptsAction({ projectId: pid, maxScenes: selectedTier.maxScenes });
      if (!gr.success) throw new Error(errMsg(gr.error));

      // 6. Safety-slice in case Claude returned more than requested
      const slicedPrompts = Array.isArray(gr.data.prompts)
        ? gr.data.prompts.slice(0, selectedTier.maxScenes)
        : gr.data.prompts;

      // 7. Calculate estimated wait time (45s per scene) and show it
      const sceneCount = Array.isArray(slicedPrompts) ? slicedPrompts.length : selectedTier.maxScenes;
      const estimatedSeconds = sceneCount * 45;
      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
      setStarEstimatedMinutes(estimatedMinutes);

      // 7b. Generate character keyframe preview via Flux img2img (non-blocking, best-effort)
      // Uses the first uploaded photo + character_bible look description
      // Runs in parallel with the Kling submission — we fire-and-forget the poll
      if (uploadedUrls.length > 0) {
        const piapiKey = process.env.NEXT_PUBLIC_PIAPI_KEY ?? "";
        const firstPhotoUrl = uploadedUrls[0];
        // Build a cinematic portrait prompt from the first Kling prompt (or a default)
        const firstPromptText = Array.isArray(slicedPrompts) && slicedPrompts.length > 0
          ? (slicedPrompts[0] as any).prompt ?? ""
          : "cinematic portrait, movie still";
        const keyframePrompt = `${firstPromptText.slice(0, 200)}, cinematic portrait, movie still, 9:16 vertical, photorealistic, dramatic lighting`;

        // Fire-and-forget: generate keyframe, poll up to 30s, then set state
        void (async () => {
          try {
            const submitRes = await fetch("https://api.piapi.ai/api/v1/task", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": piapiKey,
              },
              body: JSON.stringify({
                model: "Qubico/flux1-schnell",
                task_type: "img2img",
                input: {
                  prompt: keyframePrompt,
                  image: firstPhotoUrl,
                  width: 576,
                  height: 1024,
                },
              }),
            });
            if (!submitRes.ok) return;
            const submitData = await submitRes.json() as Record<string, unknown>;
            const kfTaskId = String(
              (submitData.data as any)?.task_id ?? submitData.task_id ?? ""
            );
            if (!kfTaskId) return;

            // Poll up to 30s (6 × 5s)
            for (let attempt = 0; attempt < 6; attempt++) {
              await new Promise((r) => setTimeout(r, 5000));
              const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${kfTaskId}`, {
                headers: { "x-api-key": piapiKey },
              });
              if (!pollRes.ok) continue;
              const pollData = await pollRes.json() as Record<string, unknown>;
              const nested = (pollData.data ?? pollData) as Record<string, unknown>;
              const status = String(nested.status ?? "").toLowerCase();
              if (status.includes("success") || status.includes("complete")) {
                // Extract image URL from PiAPI response
                const output = nested.output as Record<string, unknown> | undefined;
                const imgUrl = String(
                  (output?.image_url) ??
                  (Array.isArray(output?.images) ? (output.images as string[])[0] : "") ??
                  ""
                );
                if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
                  setStarKeyframeUrl(imgUrl);
                  // Save keyframe URL to project (best-effort)
                  try {
                    await fetch(`/api/projects/${pid}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ keyframe_url: imgUrl }),
                    });
                  } catch {}
                }
                break;
              }
              if (status.includes("fail") || status.includes("error")) break;
            }
          } catch (e) {
            console.warn("[StarMode] Keyframe generation failed (non-fatal):", e);
          }
        })();
      }

      // 8. Auto-submit to Kling — no Director Review, zero user interruption
      activePhase = "submitting_kling";
      setPipelinePhase("submitting_kling");
      const sr = await submitKlingTasksAction({
        projectId: pid,
        prompts: slicedPrompts as any,
        cinemaGlowTier,
      });
      if (!sr.success) throw new Error(errMsg(sr.error));

      const submittedIds = sr.data.tasks
        .map((t: any) => t.task_id.trim())
        .filter((id: string) => id.length > 0);
      writeKlingTaskSnapshotToStorage(pid, submittedIds);
      setLastSubmittedClipTaskIds(submittedIds);
      setClipsRefreshNonce((n) => n + 1);

      // 8. Done — VideoResultsPanel will auto-render
      setPipelinePhase("done");
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

  // ─── Star Mode: track when videos are fully done (finalize complete) ──────
  const [starVideosDone, setStarVideosDone] = useState(false);

  // ─── Waiting screen visibility ────────────────────────────────────────────
  // Show the immersive waiting screen whenever the pipeline is actively running
  // (not idle, not error, not done, not director_review pause)
  // For Star Mode: keep showing until videos are done (finalize triggered)
  const showWaitingScreen =
    (pipelineRunning || (entryMode === "star" && pipelinePhase === "done" && !starVideosDone)) &&
    pipelinePhase !== "idle" &&
    pipelinePhase !== "error" &&
    pipelinePhase !== "director_review";

return (
<div className="min-h-screen bg-black text-white">
      {/* ─── ScriptFlow Immersive Waiting Screen ────────────────────────────── */}
      <ScriptFlowWaitingScreen
        phase={pipelinePhase}
        visible={showWaitingScreen}
        estimatedMinutes={entryMode === "star" ? starEstimatedMinutes : null}
        keyframeUrl={entryMode === "star" ? starKeyframeUrl : null}
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

      {/* SquadModal (friend photo upload) — temporarily hidden, code preserved */}
      {false && showSquadModal && (
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
                SINGLE RECORDING INTERFACE
            ═══════════════════════════════════════════════════════════════ */}
            {/* ─── Single Recording Interface ──────────────────────────────── */}
            <div className="flex flex-col items-center justify-center min-h-[80vh] relative">
              {/* My Projects button — top right */}
              <div className="absolute top-0 right-0">
                <MyProjectsPanel onStartNew={startNewLazySession} />
              </div>

              {/* Camera preview area */}
              <CameraPreview />

              {/* Tell your story */}
              <p className="mt-6 text-2xl font-light tracking-wide text-white/80">Tell your story.</p>

              {/* Record button */}
              <RecordButton
                pipelineRunning={pipelineRunning}
                starPhotos={starPhotos}
                onPhotoAdded={handleStarPhotoAdded}
                onPhotoRemoved={handleStarPhotoRemoved}
                currentProjectId={currentProjectId}
                onVoiceCloned={(voiceId: string) => {
                  if (currentProjectId) {
                    void fetch(`/api/projects/${currentProjectId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ user_voice_id: voiceId }),
                    }).catch((e) => console.warn("[StarMode] Failed to save user_voice_id:", e));
                  }
                }}
                onRecord={() => void runStarModePipeline()}
              />

              {pipelineError && (
                <p className="mt-4 text-sm text-red-400 text-center max-w-xs">{pipelineError}</p>
              )}
            </div>

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

            {/* ── Video results: Be the Star mode — clean, no labels ─────────── */}
            {entryMode === "star" && pipelinePhase === "done" && projectId.trim() && (
              <section ref={clipsResultsSectionRef} className="mt-8 scroll-mt-24">
                <VideoResultsPanel
                  sessionId={projectId}
                  taskIds={lastSubmittedClipTaskIds}
                  refreshNonce={clipsRefreshNonce}
                  title=""
                  hideIntermediateState={true}
                  onAllDone={() => setStarVideosDone(true)}
                />
              </section>
            )}

            {/* ── Video results: Director mode (non-directorModeActive ghost mode) ── */}
            {entryMode === "director" && pipelinePhase === "done" && projectId.trim() && !directorModeActive && (
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
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
