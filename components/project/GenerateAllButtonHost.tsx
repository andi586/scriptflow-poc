"use client";

import type { Beat, Project } from "@/types";
import { GenerateAllButton } from "@/components/project/GenerateAllButton";

export function GenerateAllButtonHost({
  project,
  beats,
}: {
  project: Project;
  beats: Beat[];
}) {
  const parseSeasonSpec = () => {
    if (!project.script_raw) return null;
    try {
      const parsed = JSON.parse(project.script_raw) as {
        expandedStory?: {
          title?: string;
          logline?: string;
          world?: string;
          tone?: string;
          coreConflict?: string;
        };
        totalEpisodes?: 3 | 6 | 9;
        structure?: {
          threeAct?: {
            setup?: string;
            confrontation?: string;
            resolution?: string;
          };
          characters?: Array<{
            name: string;
            role: "protagonist" | "antagonist" | "supporting";
            personality: string;
            goal: string;
          }>;
          foreshadowing?: string[];
        };
      };
      if (!parsed.expandedStory || !parsed.structure || !parsed.totalEpisodes) return null;
      return {
        title: parsed.expandedStory.title ?? "",
        logline: parsed.expandedStory.logline ?? "",
        world: parsed.expandedStory.world ?? "",
        tone: parsed.expandedStory.tone ?? "",
        coreConflict: parsed.expandedStory.coreConflict ?? "",
        totalEpisodes: parsed.totalEpisodes,
        threeAct: {
          setup: parsed.structure.threeAct?.setup ?? "",
          confrontation: parsed.structure.threeAct?.confrontation ?? "",
          resolution: parsed.structure.threeAct?.resolution ?? "",
        },
        characters: parsed.structure.characters ?? [],
        foreshadowing: parsed.structure.foreshadowing ?? [],
      };
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-3">
      <GenerateAllButton
        project={project}
        beats={beats}
        onGenerateConfirmed={async () => {
          const seasonSpec = parseSeasonSpec();
          if (!seasonSpec) {
            const err = { error: "Missing seasonSpec in project.script_raw" };
            console.error("[GENERATE ERROR]", err);
            alert(JSON.stringify(err));
            return;
          }

          try {
            const res = await fetch("/api/script/episode", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId: project.id,
                episodeNumber: 1,
                seasonSpec,
              }),
            });
            const data = await res.json();
            console.log("[GENERATE RESPONSE]", JSON.stringify(data));
            if (!res.ok) {
              console.error("[GENERATE ERROR]", data);
              // 暂时不跳回，alert 显示错误
              alert(JSON.stringify(data));
              return;
            }
          } catch (e) {
            console.error("[GENERATE CATCH]", e);
            alert(String(e));
          }
        }}
      />
    </div>
  );
}

