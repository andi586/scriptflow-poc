"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DEMO_VIDEO_URL =
  "https://ktrtheitjtwpdvdvnlzj.supabase.co/storage/v1/object/public/generated-videos/b9b5aaa4-72e5-4c3b-8811-f58d9ab70fe0/final-1775168349344.mp4";

const HERO_VIDEO_URL = DEMO_VIDEO_URL;

// ─── Video Modal ───────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4" onClick={onClose}>
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm">✕ Close</button>
        <video ref={videoRef} src={DEMO_VIDEO_URL} controls playsInline className="w-full rounded-2xl" style={{ aspectRatio: "9/16" }} />
      </div>
    </div>
  );
}

// ─── FadeUp ────────────────────────────────────────────────────────────────────
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
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useFadeUp();
  return (
    <div ref={ref} className="opacity-0 translate-y-8 transition-all duration-700" style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="text-[#D4A017] font-bold text-lg tracking-tight">Heaven Cinema</Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
          <a href="#screening" className="hover:text-white transition">Watch</a>
          <a href="#director" className="hover:text-white transition">Direct</a>
          <a href="#market" className="hover:text-white transition">Market</a>
          <a href="#vault" className="hover:text-white transition">Vault</a>
        </div>
        <Link href="/app-flow" className="bg-[#D4A017] text-black text-sm font-bold px-4 py-2 rounded-full hover:bg-[#e6b520] transition">
          Enter the Cinema
        </Link>
      </nav>

      {/* ── MODULE 1: HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background video */}
        <video
          src={HERO_VIDEO_URL}
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#0A0A0B]" />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-sm font-mono tracking-[4px] uppercase mb-6">Heaven Cinema</div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-none">
              Direct Your<br />
              <span className="text-[#D4A017]">Heaven.</span>
            </h1>
            <p className="text-xl text-white/70 mb-4 max-w-2xl mx-auto">
              Here is Heaven Cinema. Today's film is yours to direct.
            </p>
            <p className="text-sm text-white/40 mb-10">
              One sentence → script → video → voice → music → subtitles → final cut. Fully automated.
            </p>
          </FadeUp>
          <FadeUp delay={200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/app-flow" className="bg-[#D4A017] text-black font-bold px-8 py-4 rounded-full text-lg hover:bg-[#e6b520] transition w-full sm:w-auto text-center">
                Enter the Cinema
              </Link>
              <button onClick={() => setShowModal(true)} className="border border-white/30 text-white px-8 py-4 rounded-full text-lg hover:border-white/60 transition w-full sm:w-auto">
                Watch Demo
              </button>
            </div>
          </FadeUp>
          <FadeUp delay={400}>
            <p className="mt-8 text-xs text-white/30 italic">
              Built in 22 days by a retired lawyer who told AI what he wanted.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 2: SCREENING HALL ── */}
      <section id="screening" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-4">Now Playing</div>
            <h2 className="text-4xl font-black mb-12">What&apos;s Playing Tonight</h2>
          </FadeUp>
          <FadeUp delay={100}>
            <div className="relative rounded-2xl overflow-hidden border border-[#D4A017]/30 max-w-xs mx-auto">
              <video src={HERO_VIDEO_URL} controls playsInline className="w-full" style={{ aspectRatio: "9/16" }} />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                <p className="text-xs text-[#D4A017] font-mono">Wolf Emperor · EP4</p>
                <p className="text-sm font-bold">The Enemy Within</p>
              </div>
            </div>
          </FadeUp>
          <FadeUp delay={200}>
            <p className="text-center text-white/50 mt-8 text-sm">This was made with one sentence. You can direct the next one.</p>
            <div className="text-center mt-4">
              <Link href="/app-flow" className="text-[#D4A017] text-sm font-bold hover:underline">
                Direct a scene like this →
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 3: DIRECTOR'S CALL ── */}
      <section id="director" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-4">The Engine</div>
            <h2 className="text-4xl font-black mb-4">The director&apos;s chair is empty.<br />Will you take it?</h2>
            <p className="text-white/50 mb-12">No crew. No code. No permission needed.</p>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {[
              { name: "NEL™", desc: "Your story, understood end-to-end. Three-act structure, emotional arcs, cinematic pacing." },
              { name: "HumanTouch Engine™", desc: "Every frame processed to feel human-made. TikTok algorithm reads it as authentic content." },
              { name: "SyncCore™", desc: "Voice, video, subtitles — perfectly synchronized. No CapCut. No manual alignment." },
              { name: "Immersive Sound Layer™", desc: "Four-track cinematic audio. Dialogue, BGM, ambience — mixed professionally, automatically." },
            ].map((tech, i) => (
              <FadeUp key={tech.name} delay={i * 100}>
                <div className="border border-[#D4A017]/30 rounded-xl p-6 bg-white/2 hover:border-[#D4A017]/60 transition">
                  <div className="text-[#D4A017] font-bold text-lg mb-2">{tech.name}</div>
                  <p className="text-white/60 text-sm leading-relaxed">{tech.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={400}>
            <div className="text-center">
              <Link href="/app-flow" className="bg-[#D4A017] text-black font-bold px-8 py-4 rounded-full text-lg hover:bg-[#e6b520] transition inline-block">
                Start Directing
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 4: CINEMA MARKET ── */}
      <section id="market" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-4">Cinema Bazaar</div>
            <h2 className="text-4xl font-black mb-4">Your creations don&apos;t disappear.<br />They come back as money.</h2>
            <p className="text-white/50 mb-12">Buy and sell characters, story seeds, shot templates, voice styles, world-building lore — anything with creative value.</p>
          </FadeUp>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
            {["Character IP", "Story Seeds", "Shot Templates", "Voice Styles", "World Lore", "Creative Seeds"].map((item, i) => (
              <FadeUp key={item} delay={i * 80}>
                <div className="border border-white/10 rounded-xl p-4 text-center hover:border-[#D4A017]/50 transition">
                  <p className="text-sm text-white/70">{item}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={300}>
            <div className="bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl p-6 text-center">
              <p className="text-[#D4A017] font-bold text-xl mb-2">Creators keep 65%</p>
              <p className="text-white/50 text-sm">of eligible revenue inside the Cinema Bazaar. Coming Q2 2026.</p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 5: SOVEREIGNTY ── */}
      <section id="vault" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-4">Creator Sovereignty</div>
            <h2 className="text-4xl font-black mb-12">Own What You Make</h2>
          </FadeUp>
          <div className="space-y-4">
            {[
              "Your stories are yours. Forever.",
              "Your characters are yours. Forever.",
              "Your worlds are yours. Forever.",
              "Zero platform cut on your TikTok or YouTube earnings.",
              "Wyoming legal framework in progress (April 6, 2026).",
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 80}>
                <div className="flex items-center gap-4 py-4 border-b border-white/5">
                  <span className="text-[#D4A017] text-xl">→</span>
                  <p className="text-white/80">{item}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULE 6: FOUNDER STORY ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-6">The Founder</div>
            <h2 className="text-3xl font-black mb-8">Built by a man who was never supposed to build this.</h2>
            <blockquote className="text-xl text-white/80 italic leading-relaxed mb-6 border-l-4 border-[#D4A017] pl-6 text-left">
              &ldquo;I&apos;m a retired lawyer with no coding skills. I told AI what I wanted. It built it. Now you can use it.&rdquo;
            </blockquote>
            <p className="text-white/40 text-sm">Jiming · Founder · Heaven Cinema · Pattaya, Thailand · 2026</p>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 7: PRICING ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-4">Choose Your Pass</div>
            <h2 className="text-4xl font-black mb-12 text-center">Every director enters differently.</h2>
          </FadeUp>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                name: "Director Pass",
                price: "$29",
                desc: "For creators ready to stop watching and start directing.",
                features: ["100 Credits/month", "Full pipeline automation", "ScriptFlow watermark", "Standard speed"],
                cta: "Claim Director Pass",
              },
              {
                name: "Market Pass",
                price: "$59",
                desc: "For creators ready to turn scenes into sellable assets.",
                features: ["500 Credits/month", "Priority queue", "Custom watermark", "Director Mode", "Advanced Analytics (Q2)"],
                cta: "Enter the Market",
                featured: true,
              },
              {
                name: "World Builder Pass",
                price: "$99",
                desc: "For creators building universes, not just clips.",
                features: ["Unlimited Credits", "No watermark", "Full Director Mode", "Team Collaboration (Q2)", "Multiple Style Profiles (Q2)"],
                cta: "Build Your World",
              },
            ].map((plan, i) => (
              <FadeUp key={plan.name} delay={i * 100}>
                <div className={`rounded-2xl p-6 border ${plan.featured ? "border-[#D4A017] bg-[#D4A017]/5" : "border-white/10"}`}>
                  {plan.featured && <div className="text-[#D4A017] text-xs font-mono tracking-[3px] uppercase mb-3">Most Popular</div>}
                  <div className="text-sm text-white/50 mb-1">{plan.name}</div>
                  <div className="text-4xl font-black mb-1">{plan.price}<span className="text-lg text-white/40">/mo</span></div>
                  <p className="text-white/50 text-sm mb-6">{plan.desc}</p>
                  <ul className="space-y-2 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="text-sm text-white/60 flex gap-2">
                        <span className="text-[#D4A017]">·</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/app-flow" className={`block text-center py-3 rounded-full font-bold text-sm transition ${plan.featured ? "bg-[#D4A017] text-black hover:bg-[#e6b520]" : "border border-white/30 hover:border-white/60"}`}>
                    {plan.cta}
                  </Link>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={300}>
            <p className="text-center text-white/30 text-sm mt-8">Or begin free, and unlock only when the moment feels right.</p>
          </FadeUp>
        </div>
      </section>

      {/* ── MODULE 8: FIRST 5 ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <FadeUp>
            <div className="text-[#D4A017] text-xs font-mono tracking-[4px] uppercase mb-6">Limited Access</div>
            <h2 className="text-4xl font-black mb-6">Only 5 golden seats<br />left in the front row.</h2>
            <p className="text-white/50 mb-10">Heaven Cinema is in its earliest chapter. Be one of the first creators who help shape what this world becomes.</p>
            <Link href="/app-flow" className="bg-[#D4A017] text-black font-bold px-10 py-5 rounded-full text-xl hover:bg-[#e6b520] transition inline-block mb-6">
              Reserve My Golden Seat
            </Link>
            <p className="text-white/30 text-sm">getscriptflow.com · @wolfemperorai · heavencinema.ai</p>
          </FadeUp>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/30 text-sm">
          <p>© 2026 ScriptFlow LLC · Wyoming USA · Your IP, your rules.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </footer>

      <VideoModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
