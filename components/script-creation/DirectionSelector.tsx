"use client";

import { Button } from "@/components/ui/button";
import type { Direction } from "@/types/script";

interface Props {
  directions: Direction[];
  onSelect: (direction: Direction) => void;
  onRegenerate: () => void;
}

export function DirectionSelector({
  directions,
  onSelect,
  onRegenerate,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {directions.map((dir, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(dir)}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-all hover:border-[#D4AF37]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                方向 {i + 1} · {dir.style}
              </span>
            </div>
            <h3 className="mb-2 font-bold text-white transition-colors group-hover:text-[#D4AF37]">
              {dir.title}
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">{dir.summary}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={onRegenerate}
          className="text-zinc-500 hover:text-white"
        >
          重新生成三个方向
        </Button>
      </div>
    </div>
  );
}
