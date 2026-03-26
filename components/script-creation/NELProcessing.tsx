"use client";

export function NELProcessing() {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-20">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 animate-ping rounded-full border-4 border-[#D4AF37] opacity-20" />
        <div className="absolute inset-0 animate-spin rounded-full border-t-4 border-[#D4AF37]" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-widest text-white">
          NEL ANALYSIS
        </h2>
        <p className="mt-2 text-zinc-500 italic">
          正在将剧本注入叙事工程引擎...
        </p>
      </div>
    </div>
  );
}
