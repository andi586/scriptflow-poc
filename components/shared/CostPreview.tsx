"use client";

import type { CostEstimate } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CostPreviewProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  estimate: CostEstimate | null;
  beatsCount: number;
}

export function CostPreview({
  open,
  onClose,
  onConfirm,
  estimate,
  beatsCount,
}: CostPreviewProps) {
  if (!estimate) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0a0a] border border-[#D4AF37]/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37] text-xl">
            Generation Quote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span>Beats</span>
            <span>{beatsCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Credits</span>
            <span className="text-[#D4AF37]">{estimate.credits.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <span>Total (USD)</span>
            <span className="text-[#D4AF37]">${estimate.usd}</span>
          </div>
          <div className="border-t border-white/10 pt-3">
            <div className="text-xs text-white/60 mb-2">Breakdown</div>
            <pre className="text-xs whitespace-pre-wrap text-white/80">
              {estimate.breakdown}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-white/70 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm()}
            className="bg-[#D4AF37] text-black hover:opacity-90"
          >
            Confirm &amp; Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

