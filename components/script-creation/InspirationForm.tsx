"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ScriptFlowState } from "@/types/script";

const GENRES = ["现代都市", "古装宫廷", "科幻", "悬疑", "爱情"] as const;
const EPISODE_COUNTS = [3, 6, 9] as const;

interface Props {
  onNext: (data: Pick<ScriptFlowState, "idea" | "genre" | "episodeCount">) => void;
}

export function InspirationForm({ onNext }: Props) {
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("现代都市");
  const [episodeCount, setEpisodeCount] = useState<3 | 6 | 9>(6);

  const isValid = idea.trim().length >= 10;

  return (
    <div className="space-y-8 rounded-xl border border-[#D4AF37]/20 bg-[#0a0a0a] p-6">
      <div className="space-y-2">
        <label className="text-sm font-medium tracking-widest text-[#D4AF37] uppercase">
          你的故事灵感
        </label>
        <Textarea
          placeholder="告诉我你的故事..."
          className="min-h-[120px] resize-none border-zinc-800 bg-black text-white focus:border-[#D4AF37]"
          maxLength={200}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <p className="text-right text-xs text-zinc-600">{idea.length} / 200</p>
      </div>

      <div className="space-y-3">
        <label className="text-sm text-zinc-400">故事风格</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(g)}
              className={`rounded border px-4 py-2 text-sm transition-all ${
                genre === g
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm text-zinc-400">集数</label>
        <div className="flex gap-4">
          {EPISODE_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEpisodeCount(n)}
              className={`rounded border px-6 py-2 text-sm transition-all ${
                episodeCount === n
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {n} 集
            </button>
          ))}
        </div>
      </div>

      <Button
        disabled={!isValid}
        onClick={() => onNext({ idea, genre, episodeCount })}
        className="h-12 w-full bg-[#D4AF37] text-base font-bold text-black hover:bg-[#B8962E]"
      >
        生成故事方向 →
      </Button>
    </div>
  );
}
