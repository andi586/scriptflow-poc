export type AssetCategory =
  | "character"
  | "music"
  | "weapon"
  | "prop"
  | "costume"
  | "scene";

export type AssetTier = "free" | "paid" | "exclusive";

export interface Asset {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  category: AssetCategory;
  tier: AssetTier;
  price: number;
  preview_url: string;
  asset_url: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAsset {
  id: string;
  user_id: string;
  asset_id: string;
  purchased_at: string;
  price_paid: number;
  transaction_id: string | null;
  created_at: string;
}

export interface AssetExclusivity {
  asset_id: string;
  owner_user_id: string;
  locked_at: string;
}

export interface AssetWithPurchaseInfo extends Asset {
  is_purchased?: boolean;
  is_exclusive_locked?: boolean;
}
