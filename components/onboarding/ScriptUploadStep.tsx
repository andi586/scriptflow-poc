"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ScriptUploadStep({
  onNext,
}: {
  onNext: (val: string) => void;
}) {
  const [text, setText] = useState("");
  const isValid = text.trim().length >= 50;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Step 1: Upload Script</h3>
      <Textarea
        placeholder="Paste your script here (min 50 characters)..."
        className="min-h-[200px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          {text.length} / 50
        </span>
        <Button disabled={!isValid} onClick={() => onNext(text)}>
          Next Step
        </Button>
      </div>
    </div>
  );
}

