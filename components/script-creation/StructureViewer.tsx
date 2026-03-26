"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { StructureResponse, ScriptFlowState } from "@/types/script";

interface Props {
  structure: StructureResponse;
  expandResult: ScriptFlowState["expandResult"];
  onConfirm: () => void;
}

export function StructureViewer({
  structure,
  expandResult,
  onConfirm,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "acts" | "characters" | "episodes" | "foreshadowing"
  >("acts");

  const tabs = [
    { id: "acts" as const, label: "三幕结构" },
    { id: "characters" as const, label: "角色" },
    { id: "episodes" as const, label: "剧情大纲" },
    { id: "foreshadowing" as const, label: "伏笔" },
  ];

  return (
    <div className="space-y-6">
      {expandResult && (
        <div className="rounded-lg border border-[#D4AF37]/30 bg-[#0a0a0a] p-4">
          <h2 className="text-lg font-bold text-[#D4AF37]">
            {expandResult.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400 italic">
            {expandResult.logline}
          </p>
        </div>
      )}

      <div className="flex gap-2 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-all ${
              activeTab === tab.id
                ? "border-[#D4AF37] text-[#D4AF37]"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {activeTab === "acts" && (
          <div className="space-y-4">
            {(["setup", "confrontation", "resolution"] as const).map(
              (act, i) => (
                <div key={act} className="rounded border border-zinc-800 p-4">
                  <div className="mb-2 text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                    第{["一", "二", "三"][i]}幕 · {["建置", "对抗", "结局"][i]}
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {structure.threeAct[act]}
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {activeTab === "characters" && (
          <div className="space-y-3">
            {structure.characters.map((char, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded border border-zinc-800 p-4"
              >
                <div className="rounded bg-zinc-800 px-2 py-1 text-xs whitespace-nowrap text-zinc-400">
                  {char.role === "protagonist"
                    ? "主角"
                    : char.role === "antagonist"
                      ? "反派"
                      : "配角"}
                </div>
                <div>
                  <div className="font-bold text-white">{char.name}</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    {char.personality}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    目标：{char.goal}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "episodes" && (
          <div className="space-y-3">
            {structure.episodes.map((ep) => (
              <div
                key={ep.episode}
                className="flex gap-4 rounded border border-zinc-800 p-3"
              >
                <div className="min-w-[40px] font-mono text-sm font-bold text-[#D4AF37]">
                  EP{ep.episode}
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {ep.summary}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "foreshadowing" && (
          <div className="space-y-3">
            {structure.foreshadowing.map((item, i) => (
              <div
                key={i}
                className="border-l-2 border-[#D4AF37] bg-zinc-900/50 py-3 pl-4"
              >
                <span className="text-xs font-bold text-[#D4AF37]">
                  伏笔 {i + 1}
                </span>
                <p className="mt-1 text-sm text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={onConfirm}
        className="h-12 w-full bg-[#D4AF37] font-bold text-black hover:bg-[#B8962E]"
      >
        确认结构，开始生成剧本 →
      </Button>
    </div>
  );
}
