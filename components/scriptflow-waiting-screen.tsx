"use client";

import { useEffect, useRef, useState } from "react";

// ─── Pipeline phase → copy mapping ────────────────────────────────────────────
type WaitingPhase =
  | "analyzing_story"
  | "generating_prompts"
  | "submitting_kling"
  | "polling_kling"
  | "generating_audio"
  | "merging"
  | "done"
  | string; // fallback for other phases

const PHASE_COPY: Record<string, string> = {
  analyzing_story: "Writing your story…",
  generating_prompts: "Designing your scenes…",
  submitting_kling: "Bringing characters to life…",
  polling_kling: "Your world is taking shape…",
  generating_audio: "Adding voice & emotion…",
  merging: "Finalizing your movie…",
  done: "🎬 Your movie is ready.",
  // Fallback for phases not in the spec
  creating_project: "Writing your story…",
  locking_characters: "Designing your scenes…",
  director_review: "Designing your scenes…",
};

function getPhrasForPhase(phase: string): string {
  return PHASE_COPY[phase] ?? "Creating your movie…";
}

// ─── Progress percentage per phase ────────────────────────────────────────────
const PHASE_PROGRESS: Record<string, number> = {
  creating_project: 8,
  analyzing_story: 22,
  locking_characters: 38,
  generating_prompts: 52,
  director_review: 60,
  submitting_kling: 75,
  polling_kling: 85,
  generating_audio: 92,
  merging: 97,
  done: 100,
};

function getProgressForPhase(phase: string): number {
  return PHASE_PROGRESS[phase] ?? 10;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface ScriptFlowWaitingScreenProps {
  phase: string;
  visible: boolean;
  /** Optional estimated wait time in minutes (shown in Be the Star mode after prompts are generated) */
  estimatedMinutes?: number | null;
}

export function ScriptFlowWaitingScreen({
  phase,
  visible,
  estimatedMinutes,
}: ScriptFlowWaitingScreenProps) {
  const [displayedPhrase, setDisplayedPhrase] = useState(() =>
    getPhrasForPhase(phase)
  );
  const [phraseOpacity, setPhraseOpacity] = useState(1);
  const [screenOpacity, setScreenOpacity] = useState(0);
  const [screenBrightness, setScreenBrightness] = useState(1);
  const pendingPhraseRef = useRef<string | null>(null);
  const transitioningRef = useRef(false);
  const prevPhaseRef = useRef(phase);

  // ── Fade screen in/out ─────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      // Small delay so the overlay mounts before fading in
      const t = setTimeout(() => setScreenOpacity(1), 30);
      return () => clearTimeout(t);
    } else {
      setScreenOpacity(0);
    }
  }, [visible]);

  // ── Brighten screen when done ──────────────────────────────────────────────
  useEffect(() => {
    if (phase === "done") {
      setScreenBrightness(1.18);
    } else {
      setScreenBrightness(1);
    }
  }, [phase]);

  // ── Cross-fade phrase when phase changes ──────────────────────────────────
  useEffect(() => {
    const newPhrase = getPhrasForPhase(phase);
    if (newPhrase === displayedPhrase && phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    if (transitioningRef.current) {
      // Queue the next phrase; it will be applied after current transition
      pendingPhraseRef.current = newPhrase;
      return;
    }

    transitioningRef.current = true;
    // Fade out
    setPhraseOpacity(0);

    const fadeOutTimer = setTimeout(() => {
      setDisplayedPhrase(newPhrase);
      pendingPhraseRef.current = null;
      // Fade in
      setPhraseOpacity(1);

      const fadeInTimer = setTimeout(() => {
        transitioningRef.current = false;
        // Apply any queued phrase
        if (pendingPhraseRef.current) {
          const queued = pendingPhraseRef.current;
          pendingPhraseRef.current = null;
          setDisplayedPhrase(queued);
        }
      }, 800);

      return () => clearTimeout(fadeInTimer);
    }, 800);

    return () => clearTimeout(fadeOutTimer);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = getProgressForPhase(phase);
  const isDone = phase === "done";

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        backgroundColor: "#0A0A0A",
        opacity: screenOpacity,
        filter: `brightness(${screenBrightness})`,
        transition: "opacity 600ms ease, filter 1200ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
      aria-live="polite"
      aria-label="Generating your movie"
    >
      {/* ── Breathing dots ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 mb-10">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block rounded-full bg-white"
            style={{
              width: 10,
              height: 10,
              animation: `sf-breathe 2s ease-in-out infinite`,
              animationDelay: `${i * 0.33}s`,
            }}
          />
        ))}
      </div>

      {/* ── Phrase ──────────────────────────────────────────────────────────── */}
      <p
        className="text-center text-lg font-light tracking-wide select-none px-8"
        style={{
          color: "rgba(255,255,255,0.88)",
          opacity: phraseOpacity,
          transition: "opacity 800ms ease",
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        {displayedPhrase}
      </p>

      {/* ── Estimated wait time (shown once known, fades in) ────────────────── */}
      {estimatedMinutes != null && estimatedMinutes > 0 && (
        <p
          className="mt-5 text-center text-sm select-none px-8"
          style={{
            color: "rgba(255,255,255,0.38)",
            maxWidth: 320,
            lineHeight: 1.5,
            animation: "sf-fadein 1s ease forwards",
          }}
        >
          Your movie will be ready in approximately {estimatedMinutes} minute{estimatedMinutes !== 1 ? "s" : ""}
        </p>
      )}

      {/* ── Progress line ───────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 2, opacity: 0.2 }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: "#ffffff",
            transition: "width 1200ms ease",
          }}
        />
      </div>

      {/* ── Keyframe styles injected inline ─────────────────────────────────── */}
      <style>{`
        @keyframes sf-breathe {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.15); }
        }
        @keyframes sf-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
