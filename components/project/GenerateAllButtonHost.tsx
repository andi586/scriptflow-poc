"use client";

import { useState } from "react";
import type { Beat, Project } from "@/types";
import { GenerateAllButton } from "@/components/project/GenerateAllButton";

export function GenerateAllButtonHost({
  project,
  beats,
}: {
  project: Project;
  beats: Beat[];
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <GenerateAllButton
        project={project}
        beats={beats}
        onGenerateConfirmed={async () => {
          setErrorMessage(null);
          let scriptRaw: unknown = null;
          try {
            scriptRaw = project.script_raw ? JSON.parse(project.script_raw) : null;
          } catch {
            scriptRaw = null;
          }
          const rawObj =
            typeof scriptRaw === "object" && scriptRaw !== null
              ? (scriptRaw as Record<string, unknown>)
              : null;
          const rawStructure =
            rawObj && typeof rawObj.structure === "object" && rawObj.structure !== null
              ? (rawObj.structure as Record<string, unknown>)
              : null;
          const seasonSpec = rawObj
            ? {
                idea: rawObj.idea,
                direction: rawObj.selectedDirection,
                expandedStory: rawObj.expandedStory,
                totalEpisodes: rawObj.totalEpisodes,
                threeAct: rawStructure?.threeAct,
                characters: rawStructure?.characters,
                episodes: rawStructure?.episodes,
                foreshadowing: rawStructure?.foreshadowing,
              }
            : null;
          if (!seasonSpec) {
            console.error("[SEASON SPEC MISSING]", project.script_raw);
            setErrorMessage("剧本数据不完整，请重新生成剧本");
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
              setErrorMessage(
                typeof data === "object" && data !== null && "error" in data
                  ? String((data as { error: unknown }).error)
                  : "生成失败，请稍后重试。"
              );
              return;
            }
          } catch (e) {
            console.error("[GENERATE CATCH]", e);
            setErrorMessage(e instanceof Error ? e.message : String(e));
          }
        }}
      />
      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
    </div>
  );
}

