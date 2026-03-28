import type { AssetCategory, AssetTier } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAssetMetadata(
  metadata: unknown,
): metadata is Record<string, unknown> {
  if (!isRecord(metadata)) return false;
  const requiredKeys = ["title", "description", "preview_url"];
  return requiredKeys.every((key) => {
    const val = metadata[key];
    return typeof val === "string" && val.trim().length > 0;
  });
}

export function isValidAssetCategory(value: unknown): value is AssetCategory {
  const validCategories: AssetCategory[] = [
    "character",
    "music",
    "weapon",
    "prop",
    "costume",
    "scene",
  ];
  return typeof value === "string" && validCategories.includes(value as AssetCategory);
}

export function isValidAssetTier(value: unknown): value is AssetTier {
  const validTiers: AssetTier[] = ["free", "paid", "exclusive"];
  return typeof value === "string" && validTiers.includes(value as AssetTier);
}

export function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `$${(price / 100).toFixed(2)}`;
}

export function validatePrice(tier: AssetTier, price: number): boolean {
  if (tier === "free") return price === 0;
  if (tier === "paid") return price > 0;
  if (tier === "exclusive") return price > 0;
  return false;
}
