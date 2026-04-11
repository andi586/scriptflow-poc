"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type TemplateId = "death" | "betrayal" | "power";
type AnimPhase = "black" | "main" | "cta";

// ─── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES: { id: TemplateId; label: string; color: string }[] = [
  { id: "death",    label: "💀 Death",    color: "text-red-500" },
  { id: "betrayal", label: "🗡️ Betrayal", color: "text-white" },
  { id: "power",    label: "👑 Power",    color: "text-yellow-300" },
];

// ─── Timing (ms) ─────────────────────────────────────────────────────────────
const BLACK_DURATION   = 500;   // initial black screen
const MAIN_DURATION    = 3200;  // main animation
const CTA_DELAY        = 200;   // brief pause before CTA appears

// ─────────────────────────────────────────────────────────────────────────────
// Death template — full-screen red countdown "00:59" with blink
// ─────────────────────────────────────────────────────────────────────────────
function DeathTemplate({ phase }: { phase: AnimPhase }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {phase === "black" && <div className="absolute inset-0 bg-black" />}

      {(phase === "main" || phase === "cta") && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black"
          style={{ animation: phase === "main" ? "deathPulse 0.8s ease-in-out infinite" : "none" }}
        >
          <p
            className="font-black text-red-500 select-none"
            style={{
              fontSize: "clamp(5rem, 28vw, 14rem)",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              animation: phase === "main" ? "deathBlink 0.9s step-start infinite" : "none",
              opacity: phase === "cta" ? 0.25 : 1,
            }}
          >
            00:59
          </p>
        </div>
      )}

      <style>{`
        @keyframes deathBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        @keyframes deathPulse {
          0%, 100% { background-color: #000; }
          50% { background-color: #1a0000; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Betrayal template — characters appear one by one
// ─────────────────────────────────────────────────────────────────────────────
const BETRAYAL_TEXT = "He said your name.";

function BetrayalTemplate({ phase }: { phase: AnimPhase }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (phase !== "main") return;
    setVisibleCount(0);
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= BETRAYAL_TEXT.length) { clearInterval(interval); return c; }
        return c + 1;
      });
    }, MAIN_DURATION / (BETRAYAL_TEXT.length + 4));
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black px-8">
      {phase === "black" && <div className="absolute inset-0 bg-black" />}

      {(phase === "main" || phase === "cta") && (
        <p
          className="font-black text-white text-center select-none"
          style={{
            fontSize: "clamp(2.8rem, 14vw, 7rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            opacity: phase === "cta" ? 0.25 : 1,
          }}
        >
          {BETRAYAL_TEXT.slice(0, visibleCount)}
          {phase === "main" && visibleCount < BETRAYAL_TEXT.length && (
            <span
              className="inline-block w-[0.08em] h-[1em] bg-white align-middle ml-1"
              style={{ animation: "cursorBlink 0.7s step-start infinite" }}
            />
          )}
        </p>
      )}

      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Power template — text starts blurred, gradually sharpens
// ─────────────────────────────────────────────────────────────────────────────
function PowerTemplate({ phase }: { phase: AnimPhase }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black px-8">
      {phase === "black" && <div className="absolute inset-0 bg-black" />}

      {(phase === "main" || phase === "cta") && (
        <p
          className="font-black text-yellow-300 text-center select-none"
          style={{
            fontSize: "clamp(2.8rem, 14vw, 7rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            opacity: phase === "cta" ? 0.25 : 1,
            animation: phase === "main" ? "powerReveal 3s ease-out forwards" : "none",
            filter: phase === "cta" ? "blur(0px)" : undefined,
          }}
        >
          They finally know.
        </p>
      )}

      <style>{`
        @keyframes powerReveal {
          0%   { filter: blur(24px); opacity: 0; }
          20%  { opacity: 1; }
          100% { filter: blur(0px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function HookPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<TemplateId | null>(null);
  const [animPhase, setAnimPhase] = useState<AnimPhase>("black");

  // Run animation sequence when a template is selected
  useEffect(() => {
    if (!selected) return;
    setAnimPhase("black");

    const t1 = setTimeout(() => setAnimPhase("main"), BLACK_DURATION);
    const t2 = setTimeout(() => setAnimPhase("cta"),  BLACK_DURATION + MAIN_DURATION + CTA_DELAY);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [selected]);

  const handleSelect = (id: TemplateId) => {
    setSelected(id);
  };

  const handleBack = () => {
    setSelected(null);
    setAnimPhase("black");
  };

  // ── Template picker ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-8 px-6">
        <div className="text-center mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-2">ScriptFlow</p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Choose Your Hook</h1>
          <p className="mt-2 text-white/40 text-sm">Pick a scene. Feel it first.</p>
        </div>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelect(tpl.id)}
              className="w-full py-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-all text-left px-6"
            >
              <p className={`text-xl font-black ${tpl.color}`}>{tpl.label}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Animation screen ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Template animation */}
      {selected === "death"    && <DeathTemplate    phase={animPhase} />}
      {selected === "betrayal" && <BetrayalTemplate phase={animPhase} />}
      {selected === "power"    && <PowerTemplate    phase={animPhase} />}

      {/* CTA overlay */}
      {animPhase === "cta" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10"
          style={{ animation: "ctaFadeIn 0.6s ease-out forwards" }}
        >
          <button
            type="button"
            onClick={() => router.push("/be-the-star")}
            className="rounded-2xl bg-white text-black font-black text-lg px-8 py-4 shadow-2xl hover:scale-105 active:scale-95 transition-transform"
          >
            Generate Your Full Story →
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="text-white/30 text-xs hover:text-white/60 transition"
          >
            ← Try another
          </button>
        </div>
      )}

      <style>{`
        @keyframes ctaFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
