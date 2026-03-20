"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  analyzeScriptAction,
  generateKlingPromptsAction,
} from "@/actions/narrative.actions";

type PromptCard = {
  beat_number: number;
  prompt: string;
};

export default function Home() {
  const [projectId, setProjectId] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<string | null>(null);
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);

  function formatError(err: unknown): string {
    if (err && typeof err === "object") {
      const maybeMessage = (err as Record<string, unknown>).message;
      if (typeof maybeMessage === "string") return maybeMessage;
    }
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="text-xl font-extrabold tracking-tight">ScriptFlow PoC</div>
        <p className="mt-2 text-sm text-white/60">
          Step 1: Script → Story Memory JSON (NEL Sentinel parser)
        </p>

        <div className="mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80">Project ID</label>
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Paste an existing projects.id"
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80">Script</label>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Paste your short drama script here..."
              rows={12}
              className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={async () => {
                setLoading(true);
                setResult(null);
                const res = await analyzeScriptAction({ projectId, scriptText });
                setResult(
                  res.success
                    ? `OK: story_memory.id=${res.data.storyMemoryId}`
          : `Error: ${JSON.stringify(res.error)}`
                );
                setLoading(false);
              }}
              disabled={loading}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {loading ? "Analyzing..." : "Analyze Script"}
            </Button>

            {result && <div className="text-sm text-white/70">{result}</div>}
          </div>
        </div>

        <p className="mt-10 text-sm text-white/60">
          Step 2: Kling Prompt Generator (Story Memory → English prompts)
        </p>

        <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              onClick={async () => {
                setPromptLoading(true);
                setPromptResult(null);
                setPromptCards([]);
                const res = await generateKlingPromptsAction({ projectId });
                if (res.success) {
                  setPromptCards(res.data.prompts);
                  setPromptResult(`OK: generated ${res.data.prompts.length} prompts`);
                } else {
                  setPromptResult(`Error: ${formatError(res.error)}`);
                }
                setPromptLoading(false);
              }}
              disabled={promptLoading}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {promptLoading ? "Generating..." : "Generate Kling Prompts"}
            </Button>

            {promptResult && <div className="text-sm text-white/70">{promptResult}</div>}
          </div>

          {promptCards.length > 0 && (
            <div className="grid gap-3">
              {promptCards.map((item) => (
                <div
                  key={`${item.beat_number}-${item.prompt.slice(0, 20)}`}
                  className="rounded-xl border border-white/10 bg-zinc-950/70 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-amber-400">
                      Scene {item.beat_number}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(item.prompt);
                        setPromptResult(`Copied scene ${item.beat_number} prompt`);
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-white/80">
                    {item.prompt}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
