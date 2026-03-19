"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeScriptAction } from "@/actions/narrative.actions";

export default function Home() {
  const [projectId, setProjectId] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

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
                setResult(res.success ? `OK: story_memory.id=${res.data.storyMemoryId}` : `Error: ${res.error}`);
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
      </main>
    </div>
  );
}
