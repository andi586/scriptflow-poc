"use client";

import { useEffect, useState } from "react";
import { Loader } from "lucide-react";
import { generateKlingPromptsAction, submitKlingTasksAction } from "@/actions/narrative.actions";

interface KlingTask {
  id: string;
  task_id: string;
  scene_index: number;
  status: "pending" | "processing" | "completed" | "failed";
  video_url: string | null;
  error_message: string | null;
  created_at: string;
}

interface ShotsPageProps {
  params: Promise<{
    id: string;
  }>;
}

// Unwrap Promise params
export default function ShotsPage(props: ShotsPageProps) {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { id } = await props.params;
      setProjectId(id);
    })();
  }, [props.params]);
  const [tasks, setTasks] = useState<KlingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [klingSubmitted, setKlingSubmitted] = useState(false);

  const fetchTasks = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    try {
      console.log("[SHOTS PAGE] Fetching tasks for projectId:", projectId);
      const res = await fetch(`/api/projects/${projectId}/kling-tasks`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`);
      }
      const data = await res.json();
      console.log("[SHOTS PAGE] Fetch success:", data);
      setTasks((data.tasks as KlingTask[]) || []);
      setError(null);
    } catch (err) {
      console.error("[FETCH TASKS ERROR]", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时自动提交Kling任务（仅一次）
  useEffect(() => {
    if (!projectId || klingSubmitted) return;

    const submitKlingTasks = async () => {
      try {
        console.log("[KLING AUTO-SUBMIT] Starting video generation on page load...");
        
        const promptsRes = await generateKlingPromptsAction({ projectId });
        if (!promptsRes.success) {
          console.error("[KLING PROMPTS] Failed:", promptsRes.error);
          return;
        }

        console.log("[KLING PROMPTS] Generated", promptsRes.data.prompts.length, "prompts");
        
        const submitRes = await submitKlingTasksAction({
          projectId,
          prompts: promptsRes.data.prompts,
        });

        if (submitRes.success) {
          console.log("[KLING SUBMIT] Success:", submitRes.data.tasks.length, "tasks submitted");
          setKlingSubmitted(true);
          // 立即刷新任务列表
          await fetchTasks();
        } else {
          console.error("[KLING SUBMIT] Failed:", submitRes.error);
        }
      } catch (klingError) {
        console.error("[KLING AUTO-SUBMIT ERROR]", klingError);
      }
    };

    submitKlingTasks();
  }, [projectId, klingSubmitted]);

  useEffect(() => {
    if (!projectId) return;
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  if (loading || !projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div className="text-center">
          <Loader className="mb-4 h-12 w-12 animate-spin text-[#D4AF37]" />
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold">镜头生成状态</h1>
        <p className="mb-8 text-zinc-400">项目 ID: {projectId}</p>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-8 text-center text-zinc-400">
            暂无镜头生成任务
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-300">
                    Scene {task.scene_index}
                  </span>
                  <StatusBadge status={task.status} />
                </div>

                {task.status === "completed" && task.video_url ? (
                  <div className="mb-3 overflow-hidden rounded-lg bg-black">
                    <video
                      src={task.video_url}
                      controls
                      className="h-40 w-full object-cover"
                    />
                  </div>
                ) : task.status === "processing" ? (
                  <div className="mb-3 flex h-40 items-center justify-center rounded-lg bg-black">
                    <Loader className="h-8 w-8 animate-spin text-[#D4AF37]" />
                  </div>
                ) : task.status === "failed" ? (
                  <div className="mb-3 flex h-40 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-center text-sm text-red-400">
                    <div>
                      <p className="font-semibold">生成失败</p>
                      {task.error_message && (
                        <p className="mt-1 text-xs">{task.error_message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 flex h-40 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-400">
                    等待生成...
                  </div>
                )}

                <p className="text-xs text-zinc-500">
                  {new Date(task.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { bg: "bg-zinc-700", text: "text-zinc-200", label: "待处理" },
    processing: { bg: "bg-blue-900", text: "text-blue-200", label: "生成中" },
    completed: { bg: "bg-green-900", text: "text-green-200", label: "已完成" },
    failed: { bg: "bg-red-900", text: "text-red-200", label: "失败" },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

