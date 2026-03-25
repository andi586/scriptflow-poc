"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ConfirmSettingsStep({
  data,
  onComplete,
}: {
  data: { aspect_ratio: string; video_duration_sec: number };
  onComplete: () => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Step 4: Confirm Global Settings</h3>
      <div className="grid gap-4">
        <div className="flex justify-between p-3 bg-muted rounded">
          <Label>Aspect Ratio</Label>
          <span className="font-mono text-primary">{data.aspect_ratio} (Locked)</span>
        </div>
        <div className="flex justify-between p-3 bg-muted rounded">
          <Label>Video Duration</Label>
          <span className="font-mono text-primary">
            {data.video_duration_sec}s (Locked)
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        * Optimized for mobile. Cannot be changed during onboarding.
      </p>
      <Button className="w-full h-12 text-lg" onClick={onComplete}>
        Finalize and Enter Project →
      </Button>
    </div>
  );
}

