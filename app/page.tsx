'use client'
import React from 'react';

const ScriptFlowHome = () => {
  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 w-full flex justify-between items-center px-8 py-6 z-20">
        <h1 className="text-[#D4A853] text-2xl font-bold tracking-wide">ScriptFlow</h1>
        <div className="flex gap-6">
          <a href="/my-videos" className="text-gray-400 hover:text-[#D4A853] transition-colors">My Movies</a>
          <a href="/credits" className="text-gray-400 hover:text-[#D4A853] transition-colors">Credits</a>
        </div>
      </nav>

      {/* Hero Section - Simplified */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Main Title - Emotional */}
          <div className="space-y-4">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              This is <span className="text-[#D4A853]">YOU</span>.<br />
              In a movie you never lived.
            </h2>
            
            <p className="text-gray-300 text-xl md:text-2xl font-light max-w-2xl mx-auto leading-relaxed">
              Upload your photo. We turn it into a cinematic story about you.
            </p>
          </div>

          {/* CTA Button - Free Preview Hook */}
          <div className="space-y-3">
            <a
              href="/create"
              className="inline-block px-12 py-5 bg-[#D4A853] hover:bg-[#e2bc74] text-black font-bold text-xl rounded-full shadow-[0_0_30px_rgba(212,168,83,0.4)] hover:shadow-[0_0_40px_rgba(212,168,83,0.6)] transition-all duration-300 transform hover:scale-105"
            >
              See Your Preview — Free
            </a>
            <p className="text-gray-500 text-sm">
              Unlock full movie · $2.9
            </p>
          </div>

          {/* Feature Cards - Emotional Copy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl mx-auto">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">You are the main character</h3>
              <p className="text-gray-400 text-sm">Not an avatar. Not a filter. You.</p>
            </div>
            
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">Stories that hit too close</h3>
              <p className="text-gray-400 text-sm">Love. Betrayal. Secrets.</p>
            </div>
            
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">It feels real</h3>
              <p className="text-gray-400 text-sm">Like a memory you forgot.</p>
            </div>
          </div>

          {/* Story Template Previews */}
          <div className="mt-16 pt-8 border-t border-[#222]">
            <h3 className="text-2xl font-bold mb-8 text-gray-300">Pick a story about you</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
              <a href="/create" className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">🌌</div>
                <p className="text-sm font-semibold text-gray-300">Your Parallel Life</p>
              </a>
              
              <a href="/create" className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">💔</div>
                <p className="text-sm font-semibold text-gray-300">She Didn't Choose You</p>
              </a>
              
              <a href="/create" className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">✨</div>
                <p className="text-sm font-semibold text-gray-300">Your Future Self Visits</p>
              </a>
              
              <a href="/create" className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">🕯️</div>
                <p className="text-sm font-semibold text-gray-300">You Lost Them</p>
              </a>
              
              <a href="/create" className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer relative">
                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">🔥</div>
                <div className="text-3xl mb-2">📰</div>
                <p className="text-sm font-semibold text-gray-300">Prank Your Friend</p>
              </a>
            </div>
          </div>

          {/* Social Proof - Fake Quotes */}
          <div className="mt-16 pt-8 border-t border-[#222]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <p className="text-gray-300 text-sm italic mb-3">
                  "That actually looks like me… wtf"
                </p>
                <p className="text-gray-500 text-xs">— Beta tester</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <p className="text-gray-300 text-sm italic mb-3">
                  "Bro I had chills watching this"
                </p>
                <p className="text-gray-500 text-xs">— Beta tester</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-6">
                <p className="text-gray-300 text-sm italic mb-3">
                  "I sent this to my ex 😂"
                </p>
                <p className="text-gray-500 text-xs">— Beta tester</p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="mt-12 pb-12">
            <a
              href="/create"
              className="inline-block px-12 py-5 bg-[#D4A853] hover:bg-[#e2bc74] text-black font-bold text-xl rounded-full shadow-[0_0_30px_rgba(212,168,83,0.4)] hover:shadow-[0_0_40px_rgba(212,168,83,0.6)] transition-all duration-300 transform hover:scale-105"
            >
              See Your Preview — Free
            </a>
            <p className="text-gray-500 text-sm mt-3">
              Join 100 beta testers shaping the future of AI storytelling
            </p>
          </div>
        </div>
      </main>

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-[#D4A853]/5 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default ScriptFlowHome;
