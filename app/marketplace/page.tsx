"use client";

import { useEffect, useState } from "react";

type MarketAsset = {
  id: string;
  seller_id: string;
  project_id: string | null;
  type: "character_pack" | "story_seed";
  title: string;
  description: string | null;
  price_cents: number;
  preview_url: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  character_pack: "Character Pack",
  story_seed: "Story Seed",
};

const TYPE_COLOR: Record<string, string> = {
  character_pack: "bg-purple-500/15 text-purple-200",
  story_seed: "bg-amber-500/15 text-amber-200",
};

function formatPrice(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export default function MarketplacePage() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/market-assets");
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setAssets(data.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <a
          href="/"
          className="text-sm font-semibold text-amber-400/90 hover:text-amber-300 flex items-center gap-1 mb-6"
        >
          ← Heaven Cinema
        </a>

        <div className="flex items-end justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Cinema Bazaar</h1>
            <p className="mt-1 text-white/60">
              Buy and sell characters, story seeds, and creative assets
            </p>
          </div>
          <a
            href="/app-flow"
            className="text-sm text-amber-400 hover:text-amber-300 font-medium"
          >
            + Create &amp; Sell
          </a>
        </div>

        <div className="mt-2 mb-8 h-px bg-white/10" />

        {/* Content */}
        {loading ? (
          <p className="text-center text-white/40 py-20">Loading marketplace…</p>
        ) : error ? (
          <p className="text-center text-red-400 py-20">Error: {error}</p>
        ) : assets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/40 text-lg">No assets listed yet.</p>
            <p className="text-white/30 text-sm mt-2">
              Be the first to sell a Character Pack or Story Seed!
            </p>
            <a
              href="/app-flow"
              className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
            >
              Create &amp; Sell
            </a>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col"
              >
                {/* Preview */}
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-white/10 mb-4">
                  {asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt={asset.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/30 text-sm">
                      No preview
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span
                  className={`self-start rounded px-2 py-0.5 text-xs font-medium mb-2 ${
                    TYPE_COLOR[asset.type] ?? "bg-white/10 text-white/60"
                  }`}
                >
                  {TYPE_LABEL[asset.type] ?? asset.type}
                </span>

                {/* Title & description */}
                <h3 className="font-semibold text-base leading-snug">{asset.title}</h3>
                {asset.description && (
                  <p className="mt-1 text-sm text-white/55 line-clamp-2 flex-1">
                    {asset.description}
                  </p>
                )}

                {/* Price + CTA */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-amber-400">
                    {formatPrice(asset.price_cents)}
                  </span>
                  <button
                    disabled
                    className="px-4 py-1.5 rounded-lg bg-white/10 text-white/40 text-sm font-medium cursor-not-allowed"
                    title="Stripe integration coming soon"
                  >
                    Coming Soon
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
