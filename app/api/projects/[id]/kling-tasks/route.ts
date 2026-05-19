import { createClient } from "@/lib/supabase/server";
import { syncMovieCompleteFromVideoUrl } from "@/lib/movie-status-sync";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = id?.trim();
    console.log("[KLING_TASKS API] Received projectId:", projectId);
    
    if (!projectId) {
      console.log("[KLING_TASKS API] Missing projectId, returning 400");
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const supabase = createClient();
    console.log("[KLING_TASKS API] Querying kling_tasks for projectId:", projectId);

    const { data: tasks, error } = await supabase
      .from("kling_tasks")
      .select("id,task_id,scene_index,status,video_url,error_message,created_at")
      .eq("project_id", projectId)
      .order("scene_index", { ascending: true });

    console.log("[KLING_TASKS API] Query result:", { tasksCount: tasks?.length || 0, error });

    if (error) {
      console.error("[KLING_TASKS QUERY ERROR]", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const completedTask = tasks?.find((task) => task.status === "success" && task.video_url);
    if (completedTask?.video_url) {
      const syncClient = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } },
          )
        : supabase;

      await syncMovieCompleteFromVideoUrl(syncClient, {
        movieId: projectId,
        taskId: completedTask.task_id,
        videoUrl: completedTask.video_url,
      });
    }

    console.log("[KLING_TASKS API] Returning", tasks?.length || 0, "tasks");
    return NextResponse.json({ tasks: tasks || [] }, { status: 200 });
  } catch (e) {
    console.error("[KLING_TASKS API ERROR]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
