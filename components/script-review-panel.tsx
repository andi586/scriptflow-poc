"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type LineBadge = "AUTO" | "EDITED" | "LOCKED";

type EditableLine = {
  character: string;
  text: string;
  badge: LineBadge;
};

type SceneBlock = {
  sceneIndex: number;
  lines: EditableLine[];
};

export type ScriptReviewPanelProps = {
  projectId: string;
  projectTitle?: string;
  /** episodes[0] from script_raw */
  episode: {
    title?: string;
    summary?: string;
    acts?: Array<{ act: number; summary: string }>;
    lines?: Array<{ character: string; text: string }>;
  };
  characters?: Array<{ name: string; description?: string; role?: string }>;
  onConfirm: (editedLines: Array<{ character: string; text: string }>) => void;
  onStartOver: () => void;
  isSaving?: boolean;
};

function badgeStyle(badge: LineBadge): string {
  switch (badge) {
    case "LOCKED":
      return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
    case "EDITED":
      return "bg-red-500/20 text-red-300 border border-red-500/40";
    default:
      return "bg-white/10 text-white/40 border border-white/15";
  }
}

export function ScriptReviewPanel({
  projectId,
  projectTitle,
  episode,
  characters = [],
  onConfirm,
  onStartOver,
  isSaving = false,
}: ScriptReviewPanelProps) {
  const rawLines: Array<{ character: string; text: string }> = episode?.lines ?? [];

  const [editableLines, setEditableLines] = useState<EditableLine[]>(() =>
    rawLines.map((l) => ({ character: l.character, text: l.text, badge: "AUTO" as LineBadge })),
  );

  const handleTextChange = useCallback((index: number, newText: string) => {
    setEditableLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? { ...line, text: newText, badge: "EDITED" }
          : line,
      ),
    );
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(editableLines.map((l) => ({ character: l.character, text: l.text })));
  }, [editableLines, onConfirm]);

  const acts = episode?.acts ?? [];
  const hasSummary = !!episode?.summary;

  return (
    <div className="space-y-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-black/40 p-6">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-amber-400">
          🎬 Director Review
        </h2>
        {episode?.title && (
          <p className="mt-0.5 text-xs text-white/50">{episode.title}</p>
        )}
      </div>

      {/* Three-act summary */}
      {(hasSummary || acts.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Story Structure
          </h3>
          {hasSummary && (
            <p className="text-sm text-white/70">{episode.summary}</p>
          )}
          {acts.map((act) => (
            <div key={act.act} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span className="mr-2 text-xs font-semibold text-amber-400">Act {act.act}</span>
              <span className="text-xs text-white/60">{act.summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Characters */}
      {characters.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Characters
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {characters.map((c) => (
              <div
                key={c.name}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <p className="text-sm font-semibold text-white">{c.name}</p>
                {c.description && (
                  <p className="mt-0.5 text-xs text-white/50">{c.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialogue lines */}
      {editableLines.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70">
            Review your script — click any line to edit
          </h3>
          <p className="text-xs text-yellow-400/70 text-center mt-1">
            💡 Tip: Write dialogue in English for best voice results.
          </p>
          {editableLines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-zinc-950/60 p-3"
            >
              <div className="min-w-[80px] shrink-0">
                <span className="text-xs font-semibold capitalize text-amber-300">
                  {line.character}
                </span>
              </div>
              <div className="flex-1">
                <textarea
                  value={line.text}
                  rows={2}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  className="w-full resize-none rounded-lg border border-white/10 bg-transparent px-2 py-1 text-sm text-white outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
                />
              </div>
              <div className="shrink-0 pt-1">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeStyle(line.badge)}`}
                >
                  {line.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button
          type="button"
          className="flex-1 bg-amber-500 font-semibold text-black hover:bg-amber-400"
          disabled={isSaving}
          onClick={handleConfirm}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Looks Good — Generate Videos"
          )}
        </Button>
        <button
          type="button"
          disabled={isSaving}
          className="border border-white/60 text-white text-sm px-4 py-2 rounded hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onStartOver}
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
