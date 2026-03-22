"use client";

import { useCallback, useState } from "react";
import type { InspirationGaps } from "@/lib/inspiration-follow-up";

type CardId = "character" | "conflict" | "ending";

const CARDS: {
  id: CardId;
  gapKey: keyof InspirationGaps;
  title: string;
  subtitle: string;
  chips: string[];
}[] = [
  {
    id: "character",
    gapKey: "needsCharacter",
    title: "Who is the main character?",
    subtitle: "主角是谁？（可点选或自填）",
    chips: [
      "A young woman who works as a pastry chef",
      "A cold CEO with a hidden soft side",
      "Two childhood friends reunited as rivals",
    ],
  },
  {
    id: "conflict",
    gapKey: "needsConflict",
    title: "What's the central conflict?",
    subtitle: "核心矛盾是什么？",
    chips: [
      "A family secret threatens their relationship",
      "They must work together but trust no one",
      "An old enemy returns to ruin everything",
    ],
  },
  {
    id: "ending",
    gapKey: "needsEnding",
    title: "How does it end?",
    subtitle: "结局走向？",
    chips: [
      "They confess and choose each other",
      "A twist reveals the real villain",
      "Bittersweet — they part but grow stronger",
    ],
  },
];

type InspirationFollowUpCardsProps = {
  gaps: InspirationGaps;
  onMerge: (snippet: string) => void;
};

export function InspirationFollowUpCards({
  gaps,
  onMerge,
}: InspirationFollowUpCardsProps) {
  const [customById, setCustomById] = useState<Partial<Record<CardId, string>>>(
    {},
  );
  const [openCustom, setOpenCustom] = useState<CardId | null>(null);

  const append = useCallback(
    (card: (typeof CARDS)[number], line: string) => {
      const q = card.title;
      const block = `\n\n[${q}] ${line.trim()}`;
      onMerge(block);
      setCustomById((prev) => ({ ...prev, [card.id]: "" }));
      setOpenCustom(null);
    },
    [onMerge],
  );

  const visible = CARDS.filter((c) => gaps[c.gapKey]).slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 space-y-3" role="region" aria-label="Story follow-up prompts">
      <p className="text-xs font-medium text-amber-200/90">
        再补充一点信息，分镜会更稳
      </p>
      <div className="grid gap-3 sm:grid-cols-1">
        {visible.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-amber-500/35 bg-zinc-950/80 p-4 shadow-sm shadow-black/20"
          >
            <h3 className="text-sm font-semibold text-white">{card.title}</h3>
            <p className="mt-0.5 text-[11px] text-white/45">{card.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {card.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-[11px] leading-snug text-amber-100/95 transition hover:border-amber-500/50 hover:bg-amber-500/10"
                  onClick={() => append(card, chip)}
                >
                  {chip}
                </button>
              ))}
              <button
                type="button"
                className="rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-[11px] text-white/55 hover:border-amber-500/40 hover:text-amber-200"
                onClick={() =>
                  setOpenCustom((o) => (o === card.id ? null : card.id))
                }
              >
                自定义一句…
              </button>
            </div>
            {openCustom === card.id && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <input
                  type="text"
                  value={customById[card.id] ?? ""}
                  onChange={(e) =>
                    setCustomById((prev) => ({
                      ...prev,
                      [card.id]: e.target.value,
                    }))
                  }
                  placeholder="Type your answer…"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-amber-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = (customById[card.id] ?? "").trim();
                      if (v) append(card, v);
                    }
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
                  onClick={() => {
                    const v = (customById[card.id] ?? "").trim();
                    if (v) append(card, v);
                  }}
                >
                  合并到灵感
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
