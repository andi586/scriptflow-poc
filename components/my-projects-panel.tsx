"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, FolderOpen, X, Plus } from "lucide-react";
import { writeLazySessionIdToStorage } from "@/lib/lazy-session-storage";

const SCRIPTFLOW_PROJECT_ID_STORAGE_KEY = "scriptflow_project_id";

type ProjectItem = {
  id: string;
  title: string | null;
  created_at: string;
  status: string | null;
  project_mode: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function statusBadge(status: string | null) {
  switch (status) {
    case "completed":
      return (
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
          Completed
        </span>
      );
    case "generating":
      return (
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
          Generating
        </span>
      );
    default:
      return (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/40">
          Draft
        </span>
      );
  }
}

export type MyProjectsPanelProps = {
  onStartNew: () => void;
};

export function MyProjectsPanel({ onStartNew }: MyProjectsPanelProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/list");
      if (res.status === 401) {
        // Not logged in — show empty list gracefully, no error
        setProjects([]);
        return;
      }
      const data = (await res.json()) as { success: boolean; projects?: ProjectItem[]; error?: string };
      if (!data.success) throw new Error(data.error ?? "Failed to load projects");
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    void fetchProjects();
  }, [fetchProjects]);

  const handleClose = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelectProject = useCallback((project: ProjectItem) => {
    writeLazySessionIdToStorage(project.id);
    try {
      window.localStorage.setItem(SCRIPTFLOW_PROJECT_ID_STORAGE_KEY, project.id);
    } catch {}
    setOpen(false);
    window.location.reload();
  }, []);

  const handleStartNew = useCallback(() => {
    setOpen(false);
    onStartNew();
  }, [onStartNew]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <FolderOpen className="size-3.5" aria-hidden />
        My Projects
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl shadow-black/60"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">My Projects</h3>
            <button
              type="button"
              onClick={handleClose}
              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Project list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/40">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </div>
            )}
            {!loading && error && (
              <p className="px-4 py-6 text-center text-xs text-red-400">{error}</p>
            )}
            {!loading && !error && projects.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-white/40">No projects yet.</p>
            )}
            {!loading && !error && projects.map((p) => {
              const displayTitle =
                !p.title || p.title === "New project"
                  ? `Project · ${timeAgo(p.created_at)}`
                  : p.title;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProject(p)}
                  className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{displayTitle}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{timeAgo(p.created_at)}</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {statusBadge(p.status)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={handleStartNew}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Plus className="size-3.5" aria-hidden />
              Start New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
