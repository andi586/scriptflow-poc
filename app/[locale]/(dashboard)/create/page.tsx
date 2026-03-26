"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InspirationForm } from "@/components/script-creation/InspirationForm";
import { DirectionSelector } from "@/components/script-creation/DirectionSelector";
import { StructureViewer } from "@/components/script-creation/StructureViewer";
import { NELProcessing } from "@/components/script-creation/NELProcessing";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import type {
  ScriptFlowState,
  DevelopExploreResponse,
  DevelopExpandResponse,
  StructureResponse,
  Direction,
} from "@/types/script";

const INITIAL_STATE: ScriptFlowState = {
  step: 1,
  idea: "",
  genre: "",
  episodeCount: 6,
  exploreResult: null,
  selectedDirection: null,
  expandResult: null,
  structureResult: null,
};

export default function CreatePage() {
  const router = useRouter();
  const [state, setState] = useState<ScriptFlowState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIdeaSubmit = async (
    data: Pick<ScriptFlowState, "idea" | "genre" | "episodeCount">
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/script/develop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "explore", idea: data.idea }),
      });
      const result = (await res.json()) as DevelopExploreResponse;
      setState((prev) => ({ ...prev, ...data, step: 2, exploreResult: result }));
    } catch {
      setError("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDirectionSelect = async (direction: Direction) => {
    if (!state.exploreResult) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/script/develop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "expand",
          idea: state.idea,
          selectedDirection: direction.summary,
        }),
      });
      const result = (await res.json()) as DevelopExpandResponse;
      setState((prev) => ({
        ...prev,
        step: 3,
        selectedDirection: direction,
        expandResult: result,
      }));

      const structRes = await fetch("/api/script/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const structure = (await structRes.json()) as StructureResponse;
      setState((prev) => ({ ...prev, structureResult: structure }));
    } catch {
      setError("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleStructureConfirm = () => {
    setState((prev) => ({ ...prev, step: 5 }));
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#080808] p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-[#D4AF37]">创作你的短剧</h1>
          <p className="text-sm text-zinc-500">一句话灵感 → 完整剧本</p>
        </div>

        <StepIndicator current={state.step} total={5} />

        {error && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="animate-pulse py-8 text-center text-zinc-500">
            AI 正在思考...
          </div>
        )}

        {!loading && state.step === 1 && (
          <InspirationForm onNext={handleIdeaSubmit} />
        )}

        {!loading && state.step === 2 && state.exploreResult && (
          <DirectionSelector
            directions={state.exploreResult.directions}
            onSelect={handleDirectionSelect}
            onRegenerate={() => setState((prev) => ({ ...prev, step: 1 }))}
          />
        )}

        {!loading && state.step === 3 && state.structureResult && (
          <StructureViewer
            structure={state.structureResult}
            episodeCount={state.episodeCount}
            expandResult={state.expandResult}
            onConfirm={handleStructureConfirm}
          />
        )}

        {state.step === 5 && <NELProcessing />}
      </div>
    </div>
  );
}
