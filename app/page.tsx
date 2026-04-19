'use client'
import React, { useRef } from 'react';

const ScriptFlowHome = () => {
  const videoRef = useRef(null);

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] text-white overflow-hidden font-serif">
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-60"
          style={{
            maskImage: 'linear-gradient(to bottom, black 50%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 95%)'
          }}
        >
          <source src="https://storage.theapi.app/videos/308546206302979.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
      </div>

      <nav className="absolute top-8 w-full flex justify-center z-20">
        <h1 className="text-[#D4A853] text-xl tracking-[0.3em] font-light">SCRIPTFLOW</h1>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-end h-screen pb-24 px-6 text-center">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight">
            YOU ARE THE <span className="italic">STORY</span>
          </h2>
          <p className="text-gray-400 text-lg md:text-xl font-light tracking-wide max-w-xs mx-auto">
            One photo. One sentence. <br />
            Your cinema begins now.
          </p>
        </div>

        <div className="mt-12 w-full max-w-sm px-4">
          <a
            href="/app-flow"
            className="group relative flex items-center justify-center w-full py-5 bg-[#D4A853] hover:bg-[#e2bc74] transition-all duration-500 rounded-full shadow-[0_0_20px_rgba(212,168,83,0.3)] overflow-hidden"
          >
            <span className="relative z-10 text-black font-bold tracking-[0.2em] text-sm">
              ENTER THE SCENE
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </a>

          <p className="mt-6 text-[10px] text-gray-600 tracking-widest uppercase">
            Heaven Cinema Production
          </p>
        </div>
      </main>

      <div className="absolute bottom-4 w-full flex justify-center opacity-30">
        <div className="w-[1px] h-8 bg-[#D4A853]" />
      </div>
    </div>
  );
};

export default ScriptFlowHome;
