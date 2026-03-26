"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InspirationForm } from "@/components/script-creation/InspirationForm";
import { DirectionSelector } from "@/components/script-creation/DirectionSelector";
import { NELProcessing } from "@/components/script-creation/NELProcessing";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/button";
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
        structureResult: null,
      }));
    } catch {
      setError("生成失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleStructureConfirm = async () => {
    if (!state.expandResult) return;
    setError(null);
    setState((prev) => ({ ...prev, step: 4 }));
    try {
      const structRes = await fetch("/api/script/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state.expandResult,
          totalEpisodes: state.episodeCount,
        }),
      });
      const structure = (await structRes.json()) as StructureResponse;
      setState((prev) => ({ ...prev, structureResult: structure, step: 5 }));
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    } catch {
      setError("生成失败，请重试");
      setState((prev) => ({ ...prev, step: 3 }));
    }
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

        {!loading && state.step === 3 && state.expandResult && (
          <div className="space-y-6 rounded-xl border border-[#D4AF37]/20 bg-[#0a0a0a] p-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#D4AF37]">
                {state.expandResult.title}
              </h2>
              <p className="text-sm text-zinc-400 italic">
                {state.expandResult.logline}
              </p>
            </div>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>世界观：{state.expandResult.world}</p>
              <p>基调：{state.expandResult.tone}</p>
              <p>核心冲突：{state.expandResult.coreConflict}</p>
              <p>人物关系：{state.expandResult.characterDynamics}</p>
            </div>
            <Button
              onClick={() => void handleStructureConfirm()}
              className="h-12 w-full bg-[#D4AF37] font-bold text-black hover:bg-[#B8962E]"
            >
              确认结构，开始生成剧本 →
            </Button>
          </div>
        )}

        {state.step === 4 && (
          <div className="py-20 text-center text-zinc-400">
            <p>正在生成剧本...</p>
          </div>
        )}

        {state.step === 5 && <NELProcessing />}
      </div>
    </div>
  );
}
