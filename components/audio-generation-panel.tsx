"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AudioGenerationPanelProps = {
  /** Supabase `projects.id` */
  projectId: string;
  /** Scene numbers to generate audio for */
  sceneNumbers: number[];
  className?: string;
};

type TTSLine = {
  character: string;
  text: string;
};

export function AudioGenerationPanel({
  projectId,
  sceneNumbers,
  className = "",
}: AudioGenerationPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrlsByScene, setAudioUrlsByScene] = useState<Record<number, string>>({});

  const generateAudio = useCallback(async () => {
    if (!projectId.trim() || sceneNumbers.length === 0) return;

    setGenerating(true);
    setError(null);

    try {
      // 1. 从 Supabase 读取 script_raw
      const supabase = createClient();
      const { data: projectData, error: fetchError } = await supabase
        .from("projects")
        .select("script_raw")
        .eq("id", projectId)
        .single();

      if (fetchError) throw new Error(`Failed to fetch project: ${fetchError.message}`);
      if (!projectData?.script_raw) throw new Error("No script data found");

      // 2. 解析 script_raw
      const scriptRaw =
        typeof projectData.script_raw === "string"
          ? JSON.parse(projectData.script_raw)
          : projectData.script_raw;

      const structure =
        scriptRaw && typeof scriptRaw === "object" && "structure" in scriptRaw
          ? scriptRaw.structure
          : null;

      const episodes =
        structure &&
        typeof structure === "object" &&
        structure !== null &&
        "episodes" in structure &&
        Array.isArray(structure.episodes)
          ? structure.episodes
          : [];

      if (episodes.length === 0) {
        throw new Error("No episodes found in script");
      }

      // 3. 提取每个场景的对话（简化版：使用 summary 作为旁白）
      const lines: TTSLine[] = [];
      for (const ep of episodes) {
        const epObj = ep as { episode?: number; summary?: string };
        const summary = epObj.summary || "";
        if (summary.trim()) {
          lines.push({
            character: "Narrator",
            text: summary.trim(),
          });
        }
      }

      if (lines.length === 0) {
        throw new Error("No dialogue found in script");
      }

      // 4. 调用 TTS API
      const ttsRes = await fetch("/api/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines,
          projectId,
        }),
      });

      if (!ttsRes.ok) {
        const errData = await ttsRes.json().catch(() => ({}));
        throw new Error(
          (errData as { error?: string }).error || `TTS API failed: ${ttsRes.status}`,
        );
      }

      const ttsData = (await ttsRes.json()) as { audioUrls: string[] };

      // 5. 将音频 URL 映射到场景编号
      const urlsByScene: Record<number, string> = {};
      for (let i = 0; i < Math.min(sceneNumbers.length, ttsData.audioUrls.length); i++) {
        urlsByScene[sceneNumbers[i]] = ttsData.audioUrls[i];
      }

      setAudioUrlsByScene(urlsByScene);
    } catch (err) {
      console.error("[AudioGenerationPanel] generation failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [projectId, sceneNumbers]);

  const hasAudio = Object.keys(audioUrlsByScene).length > 0;

  return (
    <div className={className}>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-white">配音</h4>
          {!hasAudio && (
            <Button
              type="button"
              size="sm"
              disabled={generating}
              onClick={() => void generateAudio()}
              className="border border-purple-500/50 bg-purple-500/15 text-purple-100 hover:bg-purple-500/25"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  生成中…
                </>
              ) : (
                <>
                  <Volume2 className="mr-1.5 size-4" aria-hidden />
                  生成配音
                </>
              )}
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}

        {hasAudio && (
          <div className="space-y-2">
            {sceneNumbers.map((sceneNum) => {
              const audioUrl = audioUrlsByScene[sceneNum];
              if (!audioUrl) return null;
              return (
                <div
                  key={sceneNum}
                  className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-purple-200">
                    Scene {sceneNum} 配音
                  </p>
                  <audio
                    src={audioUrl}
                    controls
                    className="w-full"
                    preload="metadata"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
