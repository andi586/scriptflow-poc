import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AspectRatio, Beat, BeatStatus, GenerationProvider, Project, ProjectStatus, SceneGrade } from "@/types";
import { GenerateAllButtonHost } from "@/components/project/GenerateAllButtonHost";

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
    script_raw: null,
    status: input.status,
    created_at: now,
    updated_at: now,
  };
}

export default async function ProjectIdPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const projectId = params.id.trim();
  if (!projectId) redirect("/new-project");

  const supabase = createClient();

  const { data: projectRow, error: projectErr } = await supabase
    .from("projects")
    .select("status,video_duration_sec,aspect_ratio")
    .eq("id", projectId)
    .single();

  if (projectErr || !projectRow) {
    redirect("/new-project");
  }

  const statusRaw = projectRow.status as ProjectStatus;
  const video_duration_sec = Number(projectRow.video_duration_sec);
  const aspect_ratio = (projectRow.aspect_ratio as AspectRatio) || "9:16";

  const { count } = await supabase
    .from("characters")
    .select("id", { count: "exact" })
    .eq("project_id", projectId);

  const charactersLength = typeof count === "number" ? count : 0;

  if (statusRaw === "draft" && charactersLength === 0) {
    redirect("/new-project");
  }

  const project = makeDummyProject({
    id: projectId,
    status: statusRaw,
    video_duration_sec: Number.isFinite(video_duration_sec)
      ? video_duration_sec
      : 5,
    aspect_ratio,
  });

  const beats = makeDummyBeats({ projectId, count: 5 });

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-2xl font-bold mb-4">Project Dashboard</h1>
      <GenerateAllButtonHost project={project} beats={beats} />
    </div>
  );
}

