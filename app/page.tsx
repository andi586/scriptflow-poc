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

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center pt-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Main Title */}
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Be the Star of Your Own <br />
            <span className="text-[#D4A853]">AI Movie</span>
          </h2>
          
          {/* Subtitle */}
          <p className="text-gray-300 text-xl md:text-2xl font-light max-w-2xl mx-auto leading-relaxed">
            Upload your photo. Choose your story. Get a cinematic 15-second film — starring <span className="text-[#D4A853] font-semibold">YOU</span>.
          </p>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <div className="text-4xl mb-3">🎬</div>
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">Your Real Face</h3>
              <p className="text-gray-400 text-sm">Not an avatar. Not a filter. You.</p>
            </div>
            
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <div className="text-4xl mb-3">💫</div>
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">Real Stories</h3>
              <p className="text-gray-400 text-sm">Drama, heartbreak, mystery, comedy</p>
            </div>
            
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 hover:border-[#D4A853] transition-all">
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-[#D4A853] font-bold text-lg mb-2">60 Seconds</h3>
              <p className="text-gray-400 text-sm">From photo to movie in under a minute</p>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-12">
            <a
              href="/create"
              className="inline-block px-12 py-5 bg-[#D4A853] hover:bg-[#e2bc74] text-black font-bold text-lg rounded-full shadow-[0_0_30px_rgba(212,168,83,0.4)] hover:shadow-[0_0_40px_rgba(212,168,83,0.6)] transition-all duration-300 transform hover:scale-105"
            >
              Create Your Movie — $2.9
            </a>
          </div>

          {/* Story Template Previews */}
          <div className="mt-16 pt-8 border-t border-[#222]">
            <h3 className="text-2xl font-bold mb-8 text-gray-300">Choose Your Story</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl mx-auto">
              <div className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">🌌</div>
                <p className="text-sm font-semibold text-gray-300">Your Parallel Life</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">💔</div>
                <p className="text-sm font-semibold text-gray-300">She Didn't Choose You</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">✨</div>
                <p className="text-sm font-semibold text-gray-300">Your Future Self Visits</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer">
                <div className="text-3xl mb-2">🕯️</div>
                <p className="text-sm font-semibold text-gray-300">You Lost Them</p>
              </div>
              
              <div className="bg-[#111] border border-[#222] rounded-xl p-4 hover:border-[#D4A853] transition-all cursor-pointer relative">
                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">🔥</div>
                <div className="text-3xl mb-2">📰</div>
                <p className="text-sm font-semibold text-gray-300">Prank Your Friend</p>
              </div>
            </div>
          </div>

          {/* Social Proof */}
          <div className="mt-12 pb-12">
            <p className="text-gray-500 text-sm">
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
