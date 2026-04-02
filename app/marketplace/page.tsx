"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AssetWithPurchaseInfo } from "@/lib/assets/types";
import { formatPrice } from "@/lib/assets/utils";

export default function MarketplacePage() {
  const [assets, setAssets] = useState<AssetWithPurchaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      setLoading(true);
      const res = await fetch("/api/assets");
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(assetId: string) {
    try {
      setPurchasing(assetId);
      const res = await fetch(`/api/assets/${assetId}/purchase`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Purchase failed: ${res.status}`);
      }
      // Refresh assets to update purchase status
      await fetchAssets();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-center text-white/60">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-center text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <a href="/" className="text-sm font-semibold text-amber-400/90 hover:text-amber-300 flex items-center gap-1 mb-6">← Heaven Cinema</a>
        <h1 className="text-3xl font-bold">Asset Marketplace</h1>
        <p className="mt-2 text-white/60">
          Browse and purchase assets for your projects
        </p>

        {assets.length === 0 ? (
          <p className="mt-8 text-center text-white/40">
            No assets available yet
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-white/10">
                  {asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/40">
                      No preview
                    </div>
                  )}
                </div>

                <h3 className="mt-4 font-semibold">{asset.name}</h3>
                {asset.description && (
                  <p className="mt-1 text-sm text-white/60">
                    {asset.description}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                    {asset.category}
                  </span>
                  <span className="rounded bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-200">
                    {asset.tier}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-amber-400">
                    {formatPrice(asset.price)}
                  </span>

                  {asset.is_purchased ? (
                    <span className="text-sm text-emerald-400">Owned</span>
                  ) : asset.is_exclusive_locked ? (
                    <span className="text-sm text-red-400">Sold Out</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={purchasing === asset.id}
                      onClick={() => handlePurchase(asset.id)}
                      className="bg-amber-500 text-black hover:bg-amber-400"
                    >
                      {purchasing === asset.id ? "Purchasing..." : "Purchase"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
