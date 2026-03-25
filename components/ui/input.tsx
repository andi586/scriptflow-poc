"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-amber-500/40",
        className,
      )}
      {...props}
    />
  );
}

