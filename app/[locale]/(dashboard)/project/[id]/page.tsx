import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AspectRatio, Beat, BeatStatus, GenerationProvider, Project, ProjectStatus, SceneGrade } from "@/types";
import { GenerateAllButtonHost } from "@/components/project/GenerateAllButtonHost";

type ScriptRawShape = {
  expandedStory?: { title?: string; logline?: string };
  structure?: {
    episodes?: Array<{ episode?: number; summary?: string }>;
    characters?: Array<{ name: string; role: "protagonist" | "antagonist" | "supporting" }>;
  };
};

function parseScriptRaw(raw: string | null): ScriptRawShape | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as ScriptRawShape;
  } catch {
    return null;
  }
}

function makeDummyBeats(input: {
  projectId: string;
  count: number;
}): Beat[] {
  const now = new Date().toISOString();
  const beats: Beat[] = [];

  for (let i = 0; i < input.count; i += 1) {
    const beat_number = i + 1;
    beats.push({
      id: crypto.randomUUID(),
      project_id: input.projectId,
      beat_number,
      description: `Beat ${beat_number}`,
      emotion: "neutral",
      scene_grade: null as SceneGrade | null,
      prompt: null,
      negative_prompt: null,
      character_ids: [],
      status: "pending" as BeatStatus,
      consistency_score: null,
      narrative_score: null,
      created_at: now,
      updated_at: now,
    });
  }

  return beats;
}

function makeDummyProject(input: {
  id: string;
  status: ProjectStatus;
  video_duration_sec: number;
  aspect_ratio: AspectRatio;
  script_raw: string | null;
}): Project {
  const now = new Date().toISOString();
  return {
    id: input.id,
    user_id: "00000000-0000-0000-0000-000000000000",
    title: "Untitled Project",
    aspect_ratio: input.aspect_ratio,
    resolution: "1080p",
    default_provider: "kling" as GenerationProvider,
    video_duration_sec: input.video_duration_sec,
    total_credits_used: 0,
    credits_budget: null,
    script_raw: input.script_raw,
    status: input.status,
    created_at: now,
    updated_at: now,
  };
}

export default async function ProjectIdPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const projectId = id?.trim();
  if (!projectId) redirect("/new-project");

  const supabase = createClient();

  const { data: projectRow, error: projectErr } = await supabase
    .from("projects")
    .select("status,video_duration_sec,aspect_ratio,script_raw,title,character_images")
    .eq("id", projectId)
    .single();

  if (projectErr || !projectRow) {
    redirect("/new-project");
  }

  const statusRaw = projectRow.status as ProjectStatus;
  const video_duration_sec = Number(projectRow.video_duration_sec);
  const aspect_ratio = (projectRow.aspect_ratio as AspectRatio) || "9:16";
  const parsedScript = parseScriptRaw((projectRow.script_raw as string | null) ?? null);
  const scenes = parsedScript?.structure?.episodes ?? [];
  const characters = parsedScript?.structure?.characters ?? [];
  const initialCharacterImages =
    typeof projectRow.character_images === "object" && projectRow.character_images !== null
      ? (projectRow.character_images as Record<string, string>)
      : {};

  const { count, error: countError } = await supabase
    .from("characters")
    .select("id", { count: "exact" })
    .eq("project_id", projectId);

  if (countError) {
    console.error("[PROJECT PAGE] Error counting characters:", countError);
  }

  const charactersLength = typeof count === "number" ? count : 0;

  // 注释掉这个重定向，允许没有 characters 表数据的项目访问
  // if (statusRaw === "draft" && charactersLength === 0) {
  //   redirect("/new-project");
  // }

  const project = makeDummyProject({
    id: projectId,
    status: statusRaw,
    video_duration_sec: Number.isFinite(video_duration_sec)
      ? video_duration_sec
      : 5,
    aspect_ratio,
    script_raw: (projectRow.script_raw as string | null) ?? null,
  });

  const beats = makeDummyBeats({ projectId, count: 5 });

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="mb-4 text-2xl font-bold">{(projectRow.title as string) || "Project Dashboard"}</h1>

      {scenes.length > 0 ? (
        <section className="mb-8 rounded-xl border border-white/10 bg-zinc-950/40 p-5">
          <h2 className="mb-3 text-lg font-semibold">场景列表（来自 script_raw）</h2>
          <div className="space-y-2">
            {scenes.map((scene, idx) => (
              <div key={`${scene.episode ?? idx}`} className="rounded-lg border border-zinc-800 p-3">
                <div className="text-sm font-semibold text-amber-300">
                  EP{scene.episode ?? idx + 1}
                </div>
                <p className="mt-1 text-sm text-zinc-300">{scene.summary ?? ""}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mb-8 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/20 p-5 text-sm text-zinc-400">
          当前项目暂无可展示的场景数据（`script_raw.structure.episodes` 为空）。
        </section>
      )}

      <GenerateAllButtonHost
        project={project}
        beats={beats}
        characters={characters}
        initialCharacterImages={initialCharacterImages}
      />
    </div>
  );
}

