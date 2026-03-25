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
  return (
    <div className="space-y-3">
      <GenerateAllButton
        project={project}
        beats={beats}
        onGenerateConfirmed={async () => {
          // Placeholder: generation pipeline is driven by the main app page.
          // This host only validates cost estimation + UI flow.
        }}
      />
    </div>
  );
}

