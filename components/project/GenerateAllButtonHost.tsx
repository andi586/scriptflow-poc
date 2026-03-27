"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import heic2any from "heic2any";
import type { Beat, Project } from "@/types";
import { GenerateAllButton } from "@/components/project/GenerateAllButton";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { generateKlingPromptsAction, submitKlingTasksAction } from "@/actions/narrative.actions";

type ScriptCharacter = {
  name: string;
  role: "protagonist" | "antagonist" | "supporting";
};

type CharacterTemplate = {
  id: string;
  label: string;
  name: string;
  reference_image_url: string;
};

export function GenerateAllButtonHost({
  project,
  beats,
  characters,
  initialCharacterImages,
}: {
  project: Project;
  beats: Beat[];
  characters: ScriptCharacter[];
  initialCharacterImages: Record<string, string>;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [characterImages, setCharacterImages] =
    useState<Record<string, string>>(initialCharacterImages);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/character-templates")
      .then((res) => res.json())
      .then((data: { templates?: CharacterTemplate[] }) => {
        setTemplates(data.templates ?? []);
      })
      .catch(() => setTemplates([]));
  }, []);

  const allLocked =
    characters.length > 0 && characters.every((char) => !!characterImages[char.name]?.trim());

  const saveCharacterImages = async (nextImages: Record<string, string>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/character-images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterImages: nextImages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Save character images failed"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const chooseTemplate = async (characterName: string, imageUrl: string) => {
    const next = { ...characterImages, [characterName]: imageUrl };
    setCharacterImages(next);
    await saveCharacterImages(next);
  };

  const uploadCustomImage = async (characterName: string, file: File) => {
    setProcessingImage(true);
    try {
      let fileToUpload: Blob | File = file;
      let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

      if (
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        /\.heic$/i.test(file.name) ||
        /\.heif$/i.test(file.name)
      ) {
        const convertedBlob = (await heic2any({ blob: file, toType: "image/jpeg" })) as Blob;
        fileToUpload = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
          type: "image/jpeg",
        });
        ext = "jpg";
      } else {
        const compressed = await imageCompression(file, {
          fileType: "image/jpeg",
          maxSizeMB: 2,
        });
        fileToUpload = compressed;
        ext = "jpg";
      }

      const safeName = characterName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = `${project.id}/locks/${safeName}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("character-images")
        .upload(path, fileToUpload, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      const { data: pub } = supabase.storage.from("character-images").getPublicUrl(path);
      const next = { ...characterImages, [characterName]: pub.publicUrl };
      setCharacterImages(next);
      await saveCharacterImages(next);
    } finally {
      setProcessingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/30 p-4">
        <h3 className="text-base font-semibold">锁定角色参考图（生成前必填）</h3>
        <p className="text-xs text-zinc-400">
          每个角色至少锁定一张图后，才能继续 Confirm &amp; Generate。
        </p>
        <div className="space-y-3">
          {characters.map((char) => (
            <div key={char.name} className="rounded-lg border border-zinc-800 p-3">
              <div className="mb-2 text-sm font-medium text-white">{char.name}</div>
              <div className="flex flex-wrap items-center gap-2">
                {templates.slice(0, 6).map((tpl) => (
                  <Button
                    key={`${char.name}-${tpl.id}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving || processingImage}
                    onClick={() => void chooseTemplate(char.name, tpl.reference_image_url)}
                  >
                    选模板：{tpl.label || tpl.name}
                  </Button>
                ))}
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-900">
                  上传自定义图
                  <input
                    type="file"
                    accept=".heic,.heif,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void uploadCustomImage(char.name, file).catch((err: unknown) => {
                        setErrorMessage(err instanceof Error ? err.message : String(err));
                      });
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              {characterImages[char.name] ? (
                <div className="mt-2">
                  <img
                    src={characterImages[char.name]}
                    alt={`${char.name} 参考图`}
                    className="h-20 w-20 rounded-lg object-cover border border-zinc-700"
                    width={80}
                    height={80}
                  />
                </div>
              ) : null
              }
              {processingImage ? (
                <p className="mt-2 text-xs text-amber-300">正在处理图片...</p>
              ) : null
              }
              <p className="mt-2 text-xs text-zinc-400">
                {characterImages[char.name] ? "已锁定" : "未锁定"}
              </p>
            </div>
          ))}
        </div>
      </section>
      <GenerateAllButton
        project={project}
        beats={beats}
        disabled={!allLocked || saving || generating}
        generating={generating}
        onGenerateConfirmed={async () => {
          setErrorMessage(null);
          setGenerating(true);

          try {
            let scriptRaw: unknown = null;
            try {
              scriptRaw = project.script_raw ? JSON.parse(project.script_raw) : null;
            } catch {
              scriptRaw = null;
            }
            const rawObj =
              typeof scriptRaw === "object" && scriptRaw !== null
                ? (scriptRaw as Record<string, unknown>)
                : null;
            const rawStructure =
              rawObj && typeof rawObj.structure === "object" && rawObj.structure !== null
                ? (rawObj.structure as Record<string, unknown>)
                : null;

            // 检查是否已有完整的剧本数据（包含episodes）
            const hasEpisodes = rawStructure && Array.isArray(rawStructure.episodes) && rawStructure.episodes.length > 0;
            
            if (hasEpisodes) {
              // 已有剧本，直接跳转到project页面
              console.log("[SCRIPT EXISTS] Project already has script data, skipping episode generation");
              console.log("[REDIRECT] Going to project page, project.id:", project.id);
              const targetPath = `/en/project/${project.id}`;
              console.log("[REDIRECT] Target path:", targetPath);
              router.push(targetPath);
              return;
            }

            // 没有剧本，需要生成
            const seasonSpec = rawObj
              ? {
                  idea: rawObj.idea,
                  direction: rawObj.selectedDirection,
                  expandedStory: rawObj.expandedStory,
                  totalEpisodes: rawObj.totalEpisodes,
                  threeAct: rawStructure?.threeAct,
                  characters: rawStructure?.characters,
                  episodes: rawStructure?.episodes,
                  foreshadowing: rawStructure?.foreshadowing,
                }
              : null;
            if (!seasonSpec) {
              console.error("[SEASON SPEC MISSING]", project.script_raw);
              setErrorMessage("剧本数据不完整，请重新生成剧本");
              setGenerating(false);
              return;
            }

            console.log("[GENERATE REQUEST] No script found, calling episode API...");

            // 创建 AbortController 用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 280000); // 280秒超时

            try {
              const res = await fetch("/api/script/episode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: project.id,
                  episodeNumber: 1,
                  seasonSpec,
                }),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);
              const data = await res.json();
              console.log("[GENERATE RESPONSE]", JSON.stringify(data));

              if (!res.ok) {
                console.error("[GENERATE ERROR]", data);
                setErrorMessage(
                  typeof data === "object" && data !== null && "error" in data
                    ? String((data as { error: unknown }).error)
                    : "生成失败，请稍后重试"
                );
                setGenerating(false);
                return;
              }

              // 剧本生成成功，立即跳转到project页面
              console.log("[GENERATE SUCCESS] Script generated, redirecting to project page");
              console.log("[REDIRECT] project.id:", project.id);
              const targetPath = `/en/project/${project.id}`;
              console.log("[REDIRECT] Target path:", targetPath);
              router.push(targetPath);
            } catch (fetchError) {
              clearTimeout(timeoutId);
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error("[GENERATE TIMEOUT] Request timed out after 280 seconds");
                setErrorMessage("生成超时，请稍后重试");
              } else {
                console.error("[GENERATE FETCH ERROR]", fetchError);
                setErrorMessage(fetchError instanceof Error ? fetchError.message : "网络请求失败");
              }
              setGenerating(false);
            }
          } catch (e) {
            console.error("[GENERATE ERROR]", e);
            setErrorMessage("生成过程出错");
            setGenerating(false);
          }
        }}
      />
      {!allLocked ? (
        <p className="text-sm text-amber-300">请先为所有角色锁定参考图，再生成视频。</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
    </div>
  );
}

