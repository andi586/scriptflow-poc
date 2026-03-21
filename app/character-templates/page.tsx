"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CharacterTemplateRow } from "@/lib/character-templates-db";

export default function CharacterTemplatesPage() {
  const [templates, setTemplates] = useState<CharacterTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [archetype, setArchetype] = useState("");
  const [styleTagsRaw, setStyleTagsRaw] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [klingPromptBase, setKlingPromptBase] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForId, setUploadForId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/character-templates", { cache: "no-store" });
      const data = (await res.json()) as {
        templates?: CharacterTemplateRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setTemplates(data.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTemplateImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const templateId = uploadForId;
    e.target.value = "";
    if (!file || !templateId) return;

    setUploadingId(templateId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const upRes = await fetch(`/api/character-templates/${templateId}`, {
        method: "POST",
        body: formData,
      });
      const upJson = (await upRes.json()) as { reference_image_url?: string; error?: string };
      if (!upRes.ok) throw new Error(upJson.error ?? upRes.statusText);
      const url = upJson.reference_image_url;
      if (!url) throw new Error("Upload did not return reference_image_url");

      const patchRes = await fetch(`/api/character-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_image_url: url }),
      });
      const patchJson = (await patchRes.json()) as {
        template?: CharacterTemplateRow;
        error?: string;
      };
      if (!patchRes.ok) throw new Error(patchJson.error ?? patchRes.statusText);
      const updated = patchJson.template;
      if (updated) {
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? updated : t)));
      } else {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingId(null);
      setUploadForId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const style_tags = styleTagsRaw
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/character-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          archetype,
          style_tags,
          reference_image_url: referenceImageUrl,
          kling_prompt_base: klingPromptBase,
        }),
      });
      const data = (await res.json()) as { template?: CharacterTemplateRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const created = data.template;
      if (created) setTemplates((prev) => [...prev, created]);
      setName("");
      setArchetype("");
      setStyleTagsRaw("");
      setReferenceImageUrl("");
      setKlingPromptBase("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Character <span className="text-amber-400">Templates</span>
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Preset looks for your cast — bind to a project from the home flow.
        </p>

        {loading && <p className="mt-8 text-sm text-white/50">Loading templates…</p>}
        {error && (
          <p className="mt-8 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTemplateImageSelected}
            />
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <Card key={tpl.id} className="overflow-hidden border-white/10 bg-white/5">
                  <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tpl.reference_image_url}
                      alt={tpl.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle>{tpl.name}</CardTitle>
                    <CardDescription className="text-amber-200/80">{tpl.archetype}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {(tpl.style_tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200/90"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploadingId === tpl.id}
                      className="w-full border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
                      onClick={() => {
                        setUploadForId(tpl.id);
                        setError(null);
                        requestAnimationFrame(() => fileInputRef.current?.click());
                      }}
                    >
                      {uploadingId === tpl.id ? "上传中…" : "上传图片"}
                    </Button>
                  </CardContent>
                  {tpl.kling_prompt_base ? (
                    <CardFooter className="border-t border-white/5 pt-3 text-xs text-white/45">
                      <span className="line-clamp-2">{tpl.kling_prompt_base}</span>
                    </CardFooter>
                  ) : null}
                </Card>
              ))}
            </div>
          </>
        )}

        <section className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-amber-400">Add template</h2>
          <p className="mt-1 text-sm text-white/50">POSTs to /api/character-templates</p>
          <form onSubmit={handleCreate} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-1">
              <label className="text-xs font-medium text-white/70">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-1">
              <label className="text-xs font-medium text-white/70">Archetype</label>
              <input
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-xs font-medium text-white/70">
                Style tags (comma-separated)
              </label>
              <input
                value={styleTagsRaw}
                onChange={(e) => setStyleTagsRaw(e.target.value)}
                placeholder="suit, cold, western"
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-xs font-medium text-white/70">Reference image URL</label>
              <input
                value={referenceImageUrl}
                onChange={(e) => setReferenceImageUrl(e.target.value)}
                type="url"
                placeholder="https://..."
                className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-xs font-medium text-white/70">Kling prompt base</label>
              <textarea
                value={klingPromptBase}
                onChange={(e) => setKlingPromptBase(e.target.value)}
                rows={3}
                className="resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-amber-500 text-black hover:bg-amber-400"
              >
                {saving ? "Saving…" : "Create template"}
              </Button>
              {formError && (
                <p className="mt-2 text-sm text-red-400" role="alert">
                  {formError}
                </p>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
