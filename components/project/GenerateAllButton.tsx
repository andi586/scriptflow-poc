"use client";

import { useState, useTransition } from "react";
import type { Beat, CostEstimate, Project } from "@/types";
import { estimateAllCosts } from "@/actions/generation.actions";
import { CostPreview } from "@/components/shared/CostPreview";
import { Button } from "@/components/ui/button";

interface Props {
  project: Project;
  beats: Beat[];
  onGenerateConfirmed: () => Promise<void>;
  disabled?: boolean;
}

export function GenerateAllButton({
  project,
  beats,
  onGenerateConfirmed,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await estimateAllCosts({ project, beats });
      setEstimate(result);
      setOpen(true);
    });
  };

  const handleConfirm = async () => {
    setOpen(false);
    await onGenerateConfirmed();
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={disabled || isPending || beats.length === 0}
        className="bg-[#D4AF37] text-black hover:opacity-90"
      >
        {isPending ? "Calculating..." : "Generate All"}
      </Button>

      <CostPreview
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        estimate={estimate}
        beatsCount={beats.length}
      />
    </>
  );
}

