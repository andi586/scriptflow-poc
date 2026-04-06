"use client";

import { useEffect, useRef, useState } from "react";
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

const ROTATING_LINES = [
  "Leave this world.",
  "Step through.",
  "You are becoming.",
  "A new life begins.",
  "Your story is forming.",
  "Fate is rewriting you.",
  "This is your world.",
  "You chose this life.",
  "They will remember you.",
  "Your world awaits.",
];

const FINAL_LINE = "The curtain rises.";
const ROTATE_INTERVAL_MS = 15_000;
const FINAL_THRESHOLD_S = 30;

export function ScriptFlowWaitingScreen({
  phase,
  visible,
  estimatedMinutes,
  keyframeUrl,
}: {
  phase: PipelinePhase;
  visible: boolean;
  estimatedMinutes?: number | null;
  keyframeUrl?: string | null;
}) {
  const [lineIndex, setLineIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startRef = useRef<number | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset and start timers when visible
  useEffect(() => {
    if (!visible) {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      setLineIndex(0);
      setFadeIn(true);
      setElapsedSeconds(0);
      startRef.current = null;
      return;
    }

    startRef.current = Date.now();
    setElapsedSeconds(0);
    setLineIndex(0);
    setFadeIn(true);

    // Elapsed seconds ticker
    elapsedTimerRef.current = setInterval(() => {
      if (startRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);

    // Rotating lines: cross-fade every ROTATE_INTERVAL_MS
    rotateTimerRef.current = setInterval(() => {
      // Fade out
      setFadeIn(false);
      setTimeout(() => {
        setLineIndex((prev) => (prev + 1) % ROTATING_LINES.length);
        setFadeIn(true);
      }, 800);
    }, ROTATE_INTERVAL_MS);

    return () => {
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  // Determine which line to show
  const totalEstimatedSeconds = estimatedMinutes != null ? estimatedMinutes * 60 : null;
  const remainingSeconds = totalEstimatedSeconds != null ? totalEstimatedSeconds - elapsedSeconds : null;
  const showFinalLine = remainingSeconds !== null && remainingSeconds <= FINAL_THRESHOLD_S && remainingSeconds >= 0;

  const displayLine = showFinalLine ? FINAL_LINE : ROTATING_LINES[lineIndex];

  // When keyframe is available, switch to "Meet your character" layout
  if (keyframeUrl) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black px-6"
        aria-live="polite"
        aria-label="Meet your character"
      >
        {/* "Meet your character." headline */}
        <h1
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          className="text-2xl sm:text-3xl font-light text-white tracking-widest text-center mb-8 select-none"
        >
          Meet your character.
        </h1>

        {/* Character keyframe image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={keyframeUrl}
          alt="Your character"
          className="w-48 sm:w-64 rounded-2xl shadow-2xl shadow-amber-500/20 border border-white/10 object-cover"
          style={{ maxHeight: "55vh", objectFit: "cover" }}
        />

        {/* Sub-caption */}
        <p
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          className="mt-6 text-sm text-white/40 tracking-widest text-center select-none"
        >
          Creating your movie...
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black"
      aria-live="polite"
      aria-label="Generating your movie"
    >
      {/* Main title — always visible */}
      <h1
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        className="text-3xl sm:text-4xl font-light text-white tracking-widest text-center mb-12 select-none"
      >
        The door is opening.
      </h1>

      {/* Rotating line — cross-fade */}
      <p
        key={displayLine}
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          transition: "opacity 0.8s ease",
          opacity: fadeIn ? 1 : 0,
        }}
        className="text-lg sm:text-xl font-light text-white/60 tracking-widest text-center select-none"
      >
        {displayLine}
      </p>
    </div>
  );
}
