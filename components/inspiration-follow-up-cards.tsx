"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  detectInspirationGaps,
  inspirationNeedsMoreLength,
  type InspirationFollowUpAnswers,
  type InspirationFollowUpDimension,
  type InspirationGaps,
} from "@/lib/inspiration-follow-up";

const DIMENSION_ORDER: InspirationFollowUpDimension[] = [
  "character",
  "conflict",
  "ending",
];

const GAP_KEY: Record<
  InspirationFollowUpDimension,
  keyof InspirationGaps
> = {
  character: "needsCharacter",
  conflict: "needsConflict",
  ending: "needsEnding",
};

const CARD_META: Record<
  InspirationFollowUpDimension,
  { title: string; subtitle: string; chips: string[] }
> = {
  character: {
    title: "Who is the main character?",
    subtitle: "",
    chips: [
      "A young woman who works as a pastry chef",
      "A cold CEO with a hidden soft side",
      "Two childhood friends reunited as rivals",
    ],
  },
  conflict: {
    title: "What's the central conflict?",
    subtitle: "",
    chips: [
      "A family secret threatens their relationship",
      "They must work together but trust no one",
      "An old enemy returns to ruin everything",
    ],
  },
  ending: {
    title: "How does it end?",
    subtitle: "",
    chips: [
      "They confess and choose each other",
      "A twist reveals the real villain",
      "Bittersweet — they part but grow stronger",
    ],
  },
};

type InspirationFollowUpCardsProps = {
  /** Raw textarea only — used to decide which dimensions still need a prompt. */
  storyIdeaRaw: string;
  answers: InspirationFollowUpAnswers;
  onSetAnswer: (
    dimension: InspirationFollowUpDimension,
    question: string,
    answer: string,
  ) => void;
};

export function InspirationFollowUpCards({
  storyIdeaRaw,
  answers,
  onSetAnswer,
}: InspirationFollowUpCardsProps) {
  const gaps = detectInspirationGaps(storyIdeaRaw);

  const [customByDim, setCustomByDim] = useState<
    Partial<Record<InspirationFollowUpDimension, string>>
  >({});
  const [openCustom, setOpenCustom] = useState<InspirationFollowUpDimension | null>(
    null,
  );

  const submit = useCallback(
    (dim: InspirationFollowUpDimension, line: string) => {
      const meta = CARD_META[dim];
      onSetAnswer(dim, meta.title, line.trim());
      setCustomByDim((prev) => ({ ...prev, [dim]: "" }));
      setOpenCustom(null);
    },
    [onSetAnswer],
  );

  const rows: ReactNode[] = [];

  for (const dim of DIMENSION_ORDER) {
    const saved = answers[dim];
    if (saved) {
      rows.push(
        <div
          key={`answered-${dim}`}
          className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">
            Answered · {dim}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{saved.question}</h3>
          <p className="mt-2 text-xs leading-relaxed text-white/80">{saved.answer}</p>
        </div>,
      );
      continue;
    }

    if (!gaps[GAP_KEY[dim]]) continue;

    const meta = CARD_META[dim];
    rows.push(
      <div
        key={`prompt-${dim}`}
        className="rounded-xl border border-amber-500/35 bg-zinc-950/80 p-4 shadow-sm shadow-black/20"
      >
        <h3 className="text-sm font-semibold text-white">{meta.title}</h3>
        <p className="mt-0.5 text-[11px] text-white/45">{meta.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.chips.map((chip) => (
            <button
              key={chip}
              type="button"
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-[11px] leading-snug text-amber-100/95 transition hover:border-amber-500/50 hover:bg-amber-500/10"
              onClick={() => submit(dim, chip)}
            >
              {chip}
            </button>
          ))}
          <button
            type="button"
            className="rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-[11px] text-white/55 hover:border-amber-500/40 hover:text-amber-200"
            onClick={() =>
              setOpenCustom((o) => (o === dim ? null : dim))
            }
          >
            Custom...
          </button>
        </div>
        {openCustom === dim && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              type="text"
              value={customByDim[dim] ?? ""}
              onChange={(e) =>
                setCustomByDim((prev) => ({ ...prev, [dim]: e.target.value }))
              }
              placeholder="Type your answer…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-amber-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (customByDim[dim] ?? "").trim();
                  if (v) submit(dim, v);
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"
              onClick={() => {
                const v = (customByDim[dim] ?? "").trim();
                if (v) submit(dim, v);
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>,
    );
  }

  const showLengthHint = inspirationNeedsMoreLength(storyIdeaRaw);

  if (rows.length === 0 && !showLengthHint) return null;

  return (
    <div
      className="mt-4 space-y-3"
      role="region"
      aria-label="Story follow-up prompts"
    >
      <p className="text-xs font-medium text-amber-200/90">
        Follow-up answers are saved separately and submitted together when you generate.
      </p>
      {showLengthHint && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/55">
          Tip: A longer idea (50+ characters) helps generate better scene breakdowns.
        </p>
      )}
      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-1">{rows}</div>
      )}
    </div>
  );
}
