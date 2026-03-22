"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  analyzeScriptAction,
  formatStoryIdeaAction,
  generateKlingPromptsAction,
  getStoryMemoryForProjectAction,
  pollKlingTasksAction,
  submitKlingTasksAction,
  type StoryMemorySummary,
} from "@/actions/narrative.actions";
import { formatUnknownError } from "@/lib/format-error";
import {
  storyboardShotsToNelScriptText,
  type StoryboardShot,
} from "@/lib/story-idea-format";
import {
  bindTemplateCharactersAction,
  listCharacterTemplatesAction,
  uploadCustomCharacterAction,
} from "@/actions/character.actions";
import { createNewProjectAction } from "@/actions/project.actions";
import type { CharacterRole } from "@/types";

type PromptCard = {
  beat_number: number;
  prompt: string;
};

type TaskCard = {
  beat_number: number;
  task_id: string;
  status: string;
  video_url?: string;
  error_message?: string;
};

type HealthPayload = {
  anthropic: "ok" | "error";
  piapi: "ok" | "error";
  supabase: "ok" | "error";
  errors: Record<string, string>;
};

type CharacterTemplate = {
  id: string;
  label: string;
  role: CharacterRole;
  name: string;
  appearance: string;
  personality: string;
  language_fingerprint: string;
  reference_image_url: string;
};

function errMsg(e: unknown): string {
  return formatUnknownError(e);
}

function HealthDot({
  label,
  status,
  errorText,
}: {
  label: string;
  status: "ok" | "error" | undefined;
  errorText?: string;
}) {
  const ok = status === "ok";
  const title = ok ? `${label}: OK` : `${label}: ${errorText ?? "error"}`;
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <span
        className={`inline-block size-2.5 rounded-full ${
          ok ? "bg-emerald-500" : "bg-red-500"
        }`}
        aria-hidden
      />
      <span className="text-[11px] text-white/50">{label}</span>
    </span>
  );
}

export default function Home() {
  const [projectId, setProjectId] = useState("");
  const [scriptText, setScriptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pollLoading, setPollLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [promptResult, setPromptResult] = useState<string | null>(null);
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [taskCards, setTaskCards] = useState<TaskCard[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [projectCreating, setProjectCreating] = useState(false);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterResult, setCharacterResult] = useState<string | null>(null);

  const [nelSummary, setNelSummary] = useState<StoryMemorySummary | null>(null);
  const [nelStoryMemoryId, setNelStoryMemoryId] = useState<string | null>(null);
  const [nelRefreshLoading, setNelRefreshLoading] = useState(false);

  const [entryMode, setEntryMode] = useState<"inspiration" | "script">("inspiration");
  const [storyIdea, setStoryIdea] = useState("");
  const [storyboardShots, setStoryboardShots] = useState<StoryboardShot[] | null>(null);
  const [inspirationAnalyzing, setInspirationAnalyzing] = useState(false);
  const [inspirationError, setInspirationError] = useState<string | null>(null);

  function updateStoryboardShot(index: number, patch: Partial<StoryboardShot>) {
    setStoryboardShots((prev) =>
      prev ? prev.map((s, i) => (i === index ? { ...s, ...patch } : s)) : null,
    );
  }

  useEffect(() => {
    fetch("/api/healthcheck")
      .then((r) => r.json())
      .then((data: HealthPayload) => setHealth(data))
      .catch(() =>
        setHealth({
          anthropic: "error",
          piapi: "error",
          supabase: "error",
          errors: { network: "Failed to fetch /api/healthcheck" },
        }),
      );
  }, []);

  useEffect(() => {
    listCharacterTemplatesAction().then((res) => {
      if (res.success) setTemplates(res.data.templates as CharacterTemplate[]);
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xl font-extrabold tracking-tight">ScriptFlow</div>
          <div
            className="flex flex-wrap items-center gap-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
            aria-label="API health (F57)"
          >
            <HealthDot
              label="Anthropic"
              status={health?.anthropic}
              errorText={health?.errors?.anthropic}
            />
            <HealthDot label="PiAPI" status={health?.piapi} errorText={health?.errors?.piapi} />
            <HealthDot
              label="Supabase"
              status={health?.supabase}
              errorText={health?.errors?.supabase}
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-white/60">从你的灵感，到你的短剧。</p>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-amber-400">Start</h2>
          <p className="mt-1 text-xs text-white/45">
            Inspiration mode uses Claude to build 9 shots; Script mode runs NEL Sentinel on your
            paste.
          </p>

          {entryMode === "inspiration" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-white/80">Inspiration</label>
                <textarea
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value)}
                  rows={5}
                  placeholder={
                    "Tell me your story idea...\n(e.g. 'A werewolf CEO falls for a human girl,\nbut his old enemy arrives')"
                  }
                  className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  className="bg-amber-500 text-black hover:bg-amber-400"
                  disabled={inspirationAnalyzing}
                  onClick={async () => {
                    setInspirationError(null);
                    setInspirationAnalyzing(true);
                    const res = await formatStoryIdeaAction({ idea: storyIdea });
                    if (res.success) {
                      setStoryboardShots(res.data.shots);
                    } else {
                      setStoryboardShots(null);
                      setInspirationError(errMsg(res.error));
                    }
                    setInspirationAnalyzing(false);
                  }}
                >
                  {inspirationAnalyzing ? "Analyzing your story..." : "Generate Script"}
                </Button>
              </div>
              {inspirationError && (
                <p className="text-sm text-red-400" role="alert">
                  {inspirationError}
                </p>
              )}
              <button
                type="button"
                className="text-left text-sm text-amber-300/90 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                onClick={() => {
                  setEntryMode("script");
                  setInspirationError(null);
                }}
              >
                Already have a script? Switch to Script Mode
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-white/80">Script mode</label>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={14}
                  placeholder="Paste your formatted script here..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  className="bg-amber-500 text-black hover:bg-amber-400"
                  disabled={loading || !projectId.trim()}
                  onClick={async () => {
                    setLoading(true);
                    setResult(null);
                    const res = await analyzeScriptAction({ projectId, scriptText });
                    if (res.success) {
                      setNelSummary(res.data.summary);
                      setNelStoryMemoryId(res.data.storyMemoryId);
                      setResult(`OK: story_memory.id=${res.data.storyMemoryId}`);
                    } else {
                      setNelSummary(null);
                      setNelStoryMemoryId(null);
                      setResult(`Error: ${errMsg(res.error)}`);
                    }
                    setLoading(false);
                  }}
                >
                  {loading ? "Analyzing..." : "Analyze Script"}
                </Button>
                {!projectId.trim() && (
                  <p className="text-xs text-white/45">Set Project ID below before analyzing.</p>
                )}
                {result && <div className="text-sm text-white/70">{result}</div>}
              </div>
              <button
                type="button"
                className="text-left text-sm text-amber-300/90 underline decoration-amber-500/40 underline-offset-4 hover:text-amber-200"
                onClick={() => {
                  setEntryMode("inspiration");
                  setInspirationError(null);
                }}
              >
                Switch to Inspiration Mode
              </button>
            </div>
          )}

          {storyboardShots && entryMode === "inspiration" && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="text-sm font-semibold text-white/90">9-shot storyboard</h3>
              <p className="mt-1 text-xs text-white/45">
                Edit shots, then continue — runs NEL Sentinel on the formatted script (same as
                Analyze Script).
              </p>
              <div className="mt-4 grid gap-4">
                {storyboardShots.map((shot, index) => (
                  <div
                    key={`${shot.number}-${index}`}
                    className="rounded-xl border border-white/10 bg-zinc-950/70 p-4"
                  >
                    <div className="mb-2 text-xs font-semibold text-amber-400">
                      Shot {shot.number}
                    </div>
                    <div className="grid gap-2">
                      <label className="text-[11px] text-white/50">Scene (visual)</label>
                      <textarea
                        value={shot.sceneDescription}
                        onChange={(e) =>
                          updateStoryboardShot(index, { sceneDescription: e.target.value })
                        }
                        rows={2}
                        className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500"
                      />
                      <label className="text-[11px] text-white/50">Dialogue / voiceover</label>
                      <textarea
                        value={shot.dialogueOrVoiceover}
                        onChange={(e) =>
                          updateStoryboardShot(index, { dialogueOrVoiceover: e.target.value })
                        }
                        rows={2}
                        className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500"
                      />
                      <label className="text-[11px] text-white/50">Emotional tone</label>
                      <input
                        value={shot.emotionalTone}
                        onChange={(e) =>
                          updateStoryboardShot(index, { emotionalTone: e.target.value })
                        }
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  className="bg-amber-500 text-black hover:bg-amber-400"
                  disabled={loading || !projectId.trim()}
                  onClick={async () => {
                    const nelScript = storyboardShotsToNelScriptText(storyboardShots);
                    setScriptText(nelScript);
                    setLoading(true);
                    setResult(null);
                    const res = await analyzeScriptAction({
                      projectId,
                      scriptText: nelScript,
                    });
                    if (res.success) {
                      setNelSummary(res.data.summary);
                      setNelStoryMemoryId(res.data.storyMemoryId);
                      setResult(`OK: story_memory.id=${res.data.storyMemoryId}`);
                    } else {
                      setNelSummary(null);
                      setNelStoryMemoryId(null);
                      setResult(`Error: ${errMsg(res.error)}`);
                    }
                    setLoading(false);
                  }}
                >
                  {loading ? "Analyzing..." : "Continue to NEL analysis"}
                </Button>
                {!projectId.trim() && (
                  <p className="text-xs text-white/45">Create or paste Project ID in the section below.</p>
                )}
              </div>
              {result && entryMode === "inspiration" && (
                <p className="mt-2 text-sm text-white/70">{result}</p>
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-amber-400">NEL Sentinel · story_memory</h2>
              <p className="mt-1 text-xs text-white/45">
                After analysis succeeds, a summary appears here. Use refresh to re-read from Supabase
                for this Project ID.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-500/40 text-amber-200"
              disabled={nelRefreshLoading || !projectId.trim()}
              onClick={async () => {
                setNelRefreshLoading(true);
                const res = await getStoryMemoryForProjectAction({ projectId });
                if (res.success) {
                  setNelSummary(res.data.summary);
                  setNelStoryMemoryId(res.data.storyMemoryId);
                  setResult(`OK: loaded story_memory.id=${res.data.storyMemoryId}`);
                } else {
                  setNelSummary(null);
                  setNelStoryMemoryId(null);
                  setResult(`Error: ${errMsg(res.error)}`);
                }
                setNelRefreshLoading(false);
              }}
            >
              {nelRefreshLoading ? "Loading…" : "Load / refresh from Supabase"}
            </Button>
          </div>

          {nelStoryMemoryId && (
            <p className="mt-3 text-xs text-white/50">
              <span className="text-white/70">story_memory.id</span>{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-amber-200/90">
                {nelStoryMemoryId}
              </code>
            </p>
          )}

          {nelSummary && (
            <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-zinc-950/70 p-4 text-sm">
              {(nelSummary.seriesTitle || nelSummary.episodeTitle) && (
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Title
                  </div>
                  <div className="text-white/90">
                    {nelSummary.seriesTitle}
                    {nelSummary.episodeTitle ? ` — ${nelSummary.episodeTitle}` : ""}
                  </div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Narrative arc
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-white/80">{nelSummary.narrativeArc || "—"}</p>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                    Tone / visual
                  </div>
                  <p className="mt-1 text-white/80">
                    <span className="text-amber-200/90">{nelSummary.tone || "—"}</span>
                    <span className="text-white/40"> · </span>
                    <span>{nelSummary.visualStyle || "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-white/60">
                <span>
                  Beats:{" "}
                  <strong className="text-amber-200">{nelSummary.beatCount}</strong>
                </span>
                <span>
                  Characters:{" "}
                  <strong className="text-amber-200">{nelSummary.characterCount}</strong>
                </span>
              </div>
            </div>
          )}

          {!nelSummary && !nelRefreshLoading && projectId.trim() && (
            <p className="mt-3 text-xs text-white/35">
              No summary in UI yet — run <span className="text-white/55">Analyze Script</span> or{" "}
              <span className="text-white/55">Continue to NEL analysis</span>, or click refresh above.
            </p>
          )}
        </section>

        <p className="mt-8 text-sm text-white/60">
          Step 0: 角色设置（模板库或上传参考图）→ 绑定到当前项目
        </p>

        <div className="mt-4 grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80">角色模板库（F63/F64）</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((tpl) => {
                const checked = selectedTemplateIds.includes(tpl.id);
                return (
                  <label
                    key={tpl.id}
                    className={`cursor-pointer rounded-xl border p-3 text-sm ${
                      checked ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-zinc-950/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedTemplateIds((prev) =>
                          e.target.checked ? [...prev, tpl.id] : prev.filter((id) => id !== tpl.id),
                        );
                      }}
                    />
                    {tpl.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={characterLoading}
              onClick={async () => {
                setCharacterLoading(true);
                setCharacterResult(null);
                const res = await bindTemplateCharactersAction({
                  projectId,
                  templateIds: selectedTemplateIds,
                });
                setCharacterResult(
                  res.success
                    ? `OK: bound ${res.data.count} template characters`
                    : `Error: ${errMsg(res.error)}`,
                );
                setCharacterLoading(false);
              }}
            >
              {characterLoading ? "Binding..." : "Bind selected templates"}
            </Button>

            <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/10 px-3 py-2 text-sm">
              Upload custom image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!projectId) {
                    setCharacterResult("Error: set Project ID first.");
                    return;
                  }
                  setCharacterLoading(true);
                  const base64 = await file.arrayBuffer().then((buf) => {
                    let binary = "";
                    const bytes = new Uint8Array(buf);
                    const chunk = 0x8000;
                    for (let i = 0; i < bytes.length; i += chunk) {
                      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
                    }
                    return btoa(binary);
                  });
                  const res = await uploadCustomCharacterAction({
                    projectId,
                    name: file.name.replace(/\.[a-zA-Z0-9]+$/, ""),
                    role: "supporting",
                    fileName: file.name,
                    mimeType: file.type || "image/jpeg",
                    base64Data: base64,
                  });
                  setCharacterResult(
                    res.success
                      ? `OK: uploaded custom character image (${res.data.path})`
                      : `Error: ${errMsg(res.error)}`,
                  );
                  setCharacterLoading(false);
                }}
              />
            </label>
          </div>

          {characterResult && <div className="text-sm text-white/70">{characterResult}</div>}
        </div>

        <div className="mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-white/80" htmlFor="project-id-input">
              Project ID
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="project-id-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Paste a projects.id UUID, or click New Project"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
              <Button
                type="button"
                variant="outline"
                disabled={projectCreating}
                className="h-auto shrink-0 border-amber-500/40 px-4 text-amber-200 hover:bg-amber-500/10 sm:self-stretch"
                onClick={async () => {
                  setProjectCreating(true);
                  setResult(null);
                  const res = await createNewProjectAction();
                  if (res.success) {
                    setProjectId(res.data.projectId);
                    setResult(`OK: created project ${res.data.projectId}`);
                  } else {
                    setResult(`Error: ${errMsg(res.error)}`);
                  }
                  setProjectCreating(false);
                }}
              >
                {projectCreating ? "Creating…" : "New Project"}
              </Button>
            </div>
            <p className="text-[11px] text-white/40">
              New Project inserts into Supabase <code className="text-white/50">projects</code> and
              fills this field with the new row&apos;s UUID (requires{" "}
              <code className="text-white/50">SCRIPTFLOW_DEMO_USER_ID</code> or{" "}
              <code className="text-white/50">SCRIPTFLOW_PROJECT_OWNER_USER_ID</code>).
            </p>
          </div>

          <p className="text-xs text-white/45">
            Enter your script in <span className="text-amber-200/80">Start → Script mode</span>, or
            use Inspiration mode and continue after the 9-shot board. NEL analysis results appear
            there.
          </p>
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
                  setPromptResult(`Error: ${errMsg(res.error)}`);
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

        <p className="mt-10 text-sm text-white/60">
          Step 3: Submit to PiAPI/Kling and generate videos (9:16, 5s, high quality)
        </p>

        <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={async () => {
                  setVideoLoading(true);
                  setVideoResult(null);
                  setTaskCards([]);
                  const res = await submitKlingTasksAction({
                    projectId,
                    prompts: promptCards,
                  });
                  if (res.success) {
                    setTaskCards(res.data.tasks);
                    setVideoResult(`Submitted ${res.data.tasks.length} tasks`);
                  } else {
                    setVideoResult(`Error: ${errMsg(res.error)}`);
                  }
                  setVideoLoading(false);
                }}
                disabled={videoLoading || promptCards.length === 0}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {videoLoading ? "Submitting..." : "Submit Kling Tasks"}
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  setPollLoading(true);
                  setVideoResult(null);
                  const res = await pollKlingTasksAction({
                    projectId,
                    sceneIndices: promptCards.map((t) => t.beat_number),
                  });
                  if (res.success) {
                    setTaskCards(res.data.tasks);
                    const done = res.data.tasks.filter((t) => t.status === "success").length;
                    setVideoResult(`Polled ${res.data.tasks.length} tasks, success ${done}`);
                  } else {
                    setVideoResult(`Error: ${errMsg(res.error)}`);
                  }
                  setPollLoading(false);
                }}
                disabled={pollLoading || promptCards.length === 0}
              >
                {pollLoading ? "Polling..." : "Poll Task Status"}
              </Button>
            </div>

            {videoResult && <div className="text-sm text-white/70">{videoResult}</div>}
          </div>

          {taskCards.length > 0 && (
            <div className="grid gap-3">
              {taskCards.map((task) => (
                <div
                  key={`${task.beat_number}-${task.task_id || task.status}`}
                  className="rounded-xl border border-white/10 bg-zinc-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-semibold text-amber-400">Scene {task.beat_number}</span>
                    <span className="text-white/60">Task ID: {task.task_id || "(none)"}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-white/80">
                      {task.status}
                    </span>
                  </div>

                  {task.error_message && (
                    <p className="mt-2 text-sm text-red-400">
                      {task.error_message}
                    </p>
                  )}

                  {task.video_url && (
                    <a
                      className="mt-2 inline-block text-sm text-emerald-400 underline"
                      href={task.video_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open video link
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
