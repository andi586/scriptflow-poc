"use client";

import { useState } from "react";

type AssetType = "character_pack" | "story_seed";

interface SellAsAssetButtonProps {
  projectId: string;
}

export function SellAsAssetButton({ projectId }: SellAsAssetButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AssetType>("character_pack");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("9.99");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = Math.round(parseFloat(priceUsd) * 100);
    if (!title.trim()) { setError("Title is required"); return; }
    if (isNaN(priceCents) || priceCents < 0) { setError("Invalid price"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/market-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim() || null,
          price_cents: priceCents,
          project_id: projectId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to list asset");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
        <p className="text-sm font-semibold text-emerald-300">🎉 Asset listed on Cinema Bazaar!</p>
        <p className="mt-1 text-xs text-white/50">
          Your asset is now visible in the marketplace.{" "}
          <a href="/marketplace" className="text-amber-400 hover:text-amber-300 underline">
            View Marketplace →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
        >
          🏪 Sell as Asset on Cinema Bazaar
        </button>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-amber-300">List on Cinema Bazaar</h3>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="text-white/40 hover:text-white/70 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Asset Type</label>
              <div className="flex gap-2">
                {(["character_pack", "story_seed"] as AssetType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      type === t
                        ? "border-amber-500 bg-amber-500/15 text-amber-200"
                        : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {t === "character_pack" ? "Character Pack" : "Story Seed"}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wolf Emperor Character Pack"
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what buyers get..."
                className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none resize-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Price (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/50">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950 pl-7 pr-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Listing…" : "List Asset"}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-white/30 text-center">
              Payment integration coming soon (Wyoming LLC in progress).
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
