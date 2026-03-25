"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={safe}
      className={cn("h-2 w-full overflow-hidden rounded bg-white/10", className)}
    >
      <div
        className="h-full bg-[#D4AF37]"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

