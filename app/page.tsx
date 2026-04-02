"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DEMO_VIDEO_URL =
  "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/generated-videos/4d922d10-38a2-485c-a2c0-ba184f4b17dd/final-1775004647765.mp4";

// ─── Video Modal ──────────────────────────────────────────────────────────────
function VideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (open) {
      v.muted = false;
      v.volume = 1.0;
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Close"
        >
          ✕
        </button>
        <video
          ref={videoRef}
          src={DEMO_VIDEO_URL}
          controls
          playsInline
          className="w-full rounded-2xl border border-[#D4A017]/40"
          style={{ aspectRatio: "9/16", objectFit: "cover" }}
        />
      </div>
    </div>
  );
}

// ─── Scroll-fade-up animation hook ───────────────────────────────────────────
function useFadeUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("opacity-100", "translate-y-0");
          el.classList.remove("opacity-0", "translate-y-8");
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useFadeUp();
  return (
    <div
      ref={ref}
      className="opacity-0 translate-y-8 transition-all duration-700 ease-out"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Reusable components ──────────────────────────────────────────────────────
function GoldButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-xl bg-[#D4A017] px-8 py-4 text-base font-bold text-black transition-all hover:bg-[#e8b520] hover:shadow-lg hover:shadow-[#D4A017]/30 active:scale-95"
    >
      {children}
    </Link>
  );
}

function OutlineButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-xl border border-[#D4A017]/60 px-8 py-4 text-base font-semibold text-[#D4A017] transition-all hover:bg-[#D4A017]/10 active:scale-95"
    >
      {children}
    </Link>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-[#D4A017]/20 bg-white/5 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const demoVideoRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#0A0A0B", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0A0B]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span
            className="text-xl font-extrabold tracking-tight text-[#D4A017]"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            ScriptFlow
          </span>
          <div className="flex items-center gap-4">
            <Link href="/app-flow" className="text-sm text-white/60 hover:text-white transition-colors">
              Sign In
            </Link>
            <GoldButton href="/app-flow">Start Free</GoldButton>
          </div>
        </div>
      </nav>

      {/* ── 1. Hero ── */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left */}
          <div className="space-y-8">
            <FadeUp>
              <h1
                className="text-3xl font-extrabold leading-tight sm:text-5xl lg:text-6xl"
                style={{ fontFamily: "'Montserrat', sans-serif" }}
              >
                Build Your IP Empire{" "}
                <span className="text-[#D4A017]">with One Sentence.</span>
              </h1>
            </FadeUp>
            <FadeUp delay={100}>
              <p className="text-lg leading-snug text-white/65">
                Stop renting your creativity to platforms.
                <br />
                Script, voices, music, subtitles — all automated.
                <br />
                You keep <span className="font-bold text-[#D4A017]">100% of your IP</span> and{" "}
                <span className="font-bold text-[#D4A017]">65% of revenue</span>.
              </p>
            </FadeUp>
            {/* Stats */}
            <FadeUp delay={200}>
              <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                {[
                  { value: "65%", label: "Revenue to you" },
                  { value: "Zero", label: "No Code Needed" },
                  { value: "100%", label: "IP ownership" },
                ].map((s) => (
                  <div key={s.label}>
                    <p
                      className="text-2xl font-bold text-[#D4A017]"
                      style={{ fontFamily: "'Montserrat', sans-serif" }}
                    >
                      {s.value}
                    </p>
                    <p className="text-xs text-white/50">{s.label}</p>
                  </div>
                ))}
              </div>
            </FadeUp>
            <FadeUp delay={300}>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/app-flow"
                  className="w-full md:w-auto inline-block rounded-xl bg-[#D4A017] px-8 py-4 text-base font-bold text-black transition-all hover:bg-[#e8b520] hover:shadow-lg hover:shadow-[#D4A017]/30 active:scale-95 md:hidden text-center"
                >
                  Build Your Empire — Free
                </Link>
                <Link
                  href="/app-flow"
                  className="hidden md:inline-block rounded-xl bg-[#D4A017] px-8 py-4 text-base font-bold text-black transition-all hover:bg-[#e8b520] hover:shadow-lg hover:shadow-[#D4A017]/30 active:scale-95"
                >
                  Start Building Your Empire — Free
                </Link>
                {/* Desktop: open modal; Mobile: open TikTok */}
                <button
                  className="hidden md:inline-block rounded-xl border border-[#D4A017]/60 px-8 py-4 text-base font-semibold text-[#D4A017] transition-all hover:bg-[#D4A017]/10 active:scale-95"
                  onClick={() => setShowModal(true)}
                >
                  Watch Demo
                </button>
                <button
                  className="md:hidden w-full inline-block rounded-xl border border-[#D4A017]/60 px-8 py-4 text-base font-semibold text-[#D4A017] transition-all hover:bg-[#D4A017]/10 active:scale-95 text-center"
                  onClick={() => {
                    document.getElementById("hero-mobile-video-card")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Watch Demo
                </button>
              </div>
            </FadeUp>

            {/* Mobile video preview card */}
            <div id="hero-mobile-video-card" className="md:hidden mt-6">
              <div
                className="relative rounded-xl overflow-hidden cursor-pointer"
                onClick={() => {
                  const v = document.getElementById("hero-mobile-video") as HTMLVideoElement;
                  if (v) {
                    v.muted = false;
                    v.volume = 1.0;
                    v.play();
                    document.getElementById("hero-mobile-cover")?.classList.add("hidden");
                  }
                }}
              >
                {/* Cover overlay (shown before play) */}
                <div
                  id="hero-mobile-cover"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
                >
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl ml-1">▶</span>
                  </div>
                  <p className="absolute bottom-4 text-white/80 text-sm">
                    Watch Wolf Emperor EP3
                  </p>
                </div>
                {/* Video */}
                <video
                  id="hero-mobile-video"
                  src="https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/generated-videos/4d922d10-38a2-485c-a2c0-ba184f4b17dd/final-1775036682376.mp4"
                  playsInline
                  muted
                  className="w-full object-cover"
                  style={{ aspectRatio: "9/16" }}
                />
              </div>
            </div>
          </div>

          {/* Right: 9:16 real video — desktop only */}
          <FadeUp delay={150}>
            <div className="hidden md:block mx-auto w-full max-w-[280px] lg:max-w-none">
              <video
                src="https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/generated-videos/4d922d10-38a2-485c-a2c0-ba184f4b17dd/final-1775004647765.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-2xl border-2 border-[#D4A017]/50"
                style={{ aspectRatio: "9/16", objectFit: "cover" }}
              />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── 2. How It Works ── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeUp>
            <h2
              className="mb-12 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              How It Works
            </h2>
          </FadeUp>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { num: "01", title: "Type one sentence", desc: "Your story idea — as short as a tweet. ScriptFlow handles the rest." },
              { num: "02", title: "ScriptFlow builds everything", desc: "Script, AI video, voice acting, BGM, subtitles — fully automated in minutes." },
              { num: "03", title: "You publish & earn 65%", desc: "Post to any platform. Keep your IP. Earn the majority of every dollar." },
            ].map((step, i) => (
              <FadeUp key={step.num} delay={i * 100}>
                <GlassCard className="p-8 h-full">
                  <p
                    className="mb-4 text-5xl font-extrabold text-[#D4A017]/30"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {step.num}
                  </p>
                  <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{step.desc}</p>
                </GlassCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Demo Video ── */}
      <section id="demo" className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <FadeUp>
            <h2
              className="mb-8 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Watch a film made with ScriptFlow
            </h2>
          </FadeUp>
          <FadeUp delay={100}>
            <p className="text-center text-sm text-white/60 mb-2 md:hidden">
              👆 Tap the video to play with sound
            </p>
            <video
              ref={demoVideoRef}
              src={DEMO_VIDEO_URL}
              controls
              playsInline
              className="w-full rounded-2xl border border-[#D4A017]/30"
            />
          </FadeUp>
        </div>
      </section>

      {/* ── 4. Revenue Comparison ── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <FadeUp>
            <h2
              className="mb-10 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              You Earn More Here
            </h2>
          </FadeUp>
          <FadeUp delay={100}>
            <GlassCard className="overflow-hidden">
              {[
                { platform: "ScriptFlow", pct: "65%", highlight: true },
                { platform: "YouTube", pct: "55%", highlight: false },
                { platform: "TikTok", pct: "30%", highlight: false },
              ].map((row, i) => (
                <div
                  key={row.platform}
                  className={`flex items-center justify-between px-8 py-5 ${
                    i < 2 ? "border-b border-white/5" : ""
                  } ${row.highlight ? "bg-[#D4A017]/10" : ""}`}
                >
                  <span
                    className={`text-base font-semibold ${row.highlight ? "text-[#D4A017]" : "text-white/70"}`}
                  >
                    {row.platform}
                  </span>
                  <span
                    className={`text-2xl font-extrabold ${row.highlight ? "text-[#D4A017]" : "text-white/40"}`}
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {row.pct}
                  </span>
                </div>
              ))}
            </GlassCard>
          </FadeUp>
        </div>
      </section>

      {/* ── 5. Creator Sovereignty ── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <FadeUp>
            <h2
              className="mb-10 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Creator Sovereignty
            </h2>
          </FadeUp>
          <FadeUp delay={100}>
            <GlassCard className="p-8">
              <ul className="space-y-4">
                {[
                  "You own every script, every frame, every character — forever.",
                  "No platform can demonetize or delete your IP.",
                  "Publish anywhere: YouTube, TikTok, Instagram, your own site.",
                  "Your audience data stays yours — no lock-in.",
                  "Build a catalog of IP that compounds in value over time.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0 text-[#D4A017]">✦</span>
                    <span className="text-sm leading-relaxed text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </FadeUp>
        </div>
      </section>

      {/* ── 6. Why This Is Different ── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeUp>
            <h2
              className="mb-12 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Why This Is Different
            </h2>
          </FadeUp>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: "🎬",
                title: "Your AI Director",
                subtitle: "NEL Engine",
                desc: "Our Narrative Engine Layer understands story structure, character arcs, and cinematic language — not just text-to-video.",
              },
              {
                icon: "🛡️",
                title: "AI-Slop Filter",
                subtitle: "HTS Quality Guard",
                desc: "Human Taste Score automatically rejects generic AI output. Every scene passes a quality bar before it reaches you.",
              },
              {
                icon: "⚡",
                title: "24/7 Production Studio",
                subtitle: "F80 Pipeline",
                desc: "Script → video → voice → music → subtitles → final cut. Fully automated. No editors, no studios, no waiting.",
              },
            ].map((card, i) => (
              <FadeUp key={card.title} delay={i * 100}>
                <GlassCard className="p-8 h-full">
                  <div className="mb-4 text-4xl">{card.icon}</div>
                  <h3 className="mb-1 text-lg font-bold text-white">{card.title}</h3>
                  <p className="mb-3 text-xs font-semibold text-[#D4A017]/70">{card.subtitle}</p>
                  <p className="text-sm leading-relaxed text-white/55">{card.desc}</p>
                </GlassCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Pricing ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <FadeUp>
            <h2
              className="mb-4 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Simple Pricing
            </h2>
            <p className="mb-12 text-center text-sm text-white/50">No hidden fees. Cancel anytime.</p>
          </FadeUp>
          <div className="grid gap-6 sm:grid-cols-3 items-stretch">
            {[
              {
                name: "Basic",
                price: "$29",
                tagline: "Perfect for your first drama series.",
                features: ["5 episodes/month", "AI voice acting", "Auto subtitles", "BGM included", "65% revenue share"],
                highlight: false,
              },
              {
                name: "Professional",
                price: "$59",
                tagline: "For creators building a real IP catalog.",
                features: ["20 episodes/month", "BGM library", "Director Mode", "Priority rendering", "65% revenue share"],
                highlight: true,
              },
              {
                name: "Studio",
                price: "$99",
                tagline: "Run a full production studio, solo.",
                features: ["Unlimited episodes", "Custom characters", "White-label export", "API access", "65% revenue share"],
                highlight: false,
              },
            ].map((plan, i) => (
              <FadeUp key={plan.name} delay={i * 100}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-8 ${
                    plan.highlight
                      ? "border-[#D4A017] bg-[#D4A017]/10"
                      : "border-[#D4A017]/20 bg-white/5"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#D4A017] px-4 py-1 text-xs font-bold text-black">
                      Most Popular
                    </div>
                  )}
                  <h3
                    className="mb-1 text-xl font-extrabold text-white"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {plan.name}
                  </h3>
                  <p className="mb-1 text-xs text-white/50">{plan.tagline}</p>
                  <p
                    className="mb-6 text-4xl font-extrabold text-[#D4A017]"
                    style={{ fontFamily: "'Montserrat', sans-serif" }}
                  >
                    {plan.price}
                    <span className="text-base font-normal text-white/40">/mo</span>
                  </p>
                  <ul className="mb-8 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                        <span className="text-[#D4A017]">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/app-flow"
                    className={`mt-auto block w-full rounded-xl py-3 text-center text-sm font-bold transition-all ${
                      plan.highlight
                        ? "bg-[#D4A017] text-black hover:bg-[#e8b520]"
                        : "border border-[#D4A017]/50 text-[#D4A017] hover:bg-[#D4A017]/10"
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <FadeUp>
            <h2
              className="mb-12 text-center text-3xl font-extrabold sm:text-4xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Frequently Asked Questions
            </h2>
          </FadeUp>
          <div className="space-y-4">
            {[
              {
                q: "Do I need any video editing or coding skills?",
                a: "Zero. Type your idea, click generate. ScriptFlow handles everything from script to final cut.",
              },
              {
                q: "Who owns the content I create?",
                a: "You do. 100%. Every script, character, and frame belongs to you — forever. We never claim ownership of your IP.",
              },
              {
                q: "How does the 65% revenue share work?",
                a: "When you monetize through ScriptFlow's distribution network, you keep 65% of all revenue. Publish anywhere else and keep 100%.",
              },
              {
                q: "How long does it take to generate a drama episode?",
                a: "Typically 5–15 minutes from idea to finished episode, depending on length and rendering queue.",
              },
              {
                q: "Can I use my own characters and voice actors?",
                a: "Yes. Upload reference photos for custom characters. Professional plan and above includes custom voice cloning.",
              },
            ].map((faq, i) => (
              <FadeUp key={i} delay={i * 60}>
                <GlassCard className="p-6">
                  <h3 className="mb-2 text-sm font-bold text-white">{faq.q}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{faq.a}</p>
                </GlassCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. Final CTA ── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <FadeUp>
            <h2
              className="mb-6 text-4xl font-extrabold leading-tight sm:text-5xl"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Your Empire Starts with{" "}
              <span className="text-[#D4A017]">One Sentence.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={100}>
            <p className="mb-10 text-lg text-white/60">
              Be among the first creators to own their IP empire.
            </p>
          </FadeUp>
          <FadeUp delay={200}>
            <GoldButton href="/app-flow">
              Build My First Drama Now — It&apos;s Free
            </GoldButton>
          </FadeUp>
        </div>
      </section>

      {/* ── Video Modal ── */}
      <VideoModal open={showModal} onClose={() => setShowModal(false)} />

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center space-y-2">
          <p className="text-xs text-white/30">
            © 2025 ScriptFlow. All rights reserved. Your IP, your rules.
          </p>
          <p className="text-xs text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
