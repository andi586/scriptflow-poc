"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type NelResult = {
  narrative_arc: string;
  tone: string;
};

export function NELAnalysisStep({
  script,
  onContinue,
}: {
  script: string;
  onContinue: (val: NelResult) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<NelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/nel/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}`);
        }

        const data = (await response.json()) as NelResult;
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "NEL analysis failed.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [script]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">NEL Engine: Parsing narrative beats...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 space-y-6">
      <CheckCircle2 className="h-10 w-10 text-green-500" />
      <div className="text-center space-y-2 w-full">
        <h3 className="font-bold">Analysis Complete</h3>
        <div className="text-left p-4 bg-muted rounded-lg space-y-2">
          <p className="text-xs text-muted-foreground">
            Tone:{" "}
            <span className="text-foreground">{result?.tone}</span>
          </p>
          <p className="text-sm border-t pt-2">
            {result?.narrative_arc}
          </p>
        </div>
      </div>
      <Button
        onClick={() => {
          if (!result) return;
          onContinue(result);
        }}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}

