import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Asset, AssetWithPurchaseInfo } from "@/lib/assets/types";
import {
  isValidAssetCategory,
  isValidAssetTier,
  validatePrice,
} from "@/lib/assets/utils";

/**
 * GET /api/assets
 * List all active assets (with optional filters)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const tier = searchParams.get("tier");

    const supabase = createClient();

    let query = supabase
      .from("assets")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (category && isValidAssetCategory(category)) {
      query = query.eq("category", category);
    }

    if (tier && isValidAssetTier(tier)) {
      query = query.eq("tier", tier);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Check if user is authenticated to show purchase status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: userAssets } = await supabase
        .from("user_assets")
        .select("asset_id")
        .eq("user_id", user.id);

      const purchasedIds = new Set(
        (userAssets ?? []).map((ua) => ua.asset_id),
      );

      const { data: exclusiveAssets } = await supabase
        .from("asset_exclusivity")
        .select("asset_id");

      const exclusiveIds = new Set(
        (exclusiveAssets ?? []).map((ea) => ea.asset_id),
      );

      const assetsWithInfo: AssetWithPurchaseInfo[] = (data ?? []).map(
        (asset) => ({
          ...asset,
          is_purchased: purchasedIds.has(asset.id),
          is_exclusive_locked: exclusiveIds.has(asset.id),
        }),
      );

      return NextResponse.json({ assets: assetsWithInfo });
    }

    return NextResponse.json({ assets: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assets
 * Create a new asset (creator only)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      name,
      description,
      category,
      tier,
      price,
      preview_url,
      asset_url,
      tags,
      metadata,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    if (!isValidAssetCategory(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 },
      );
    }

    if (!isValidAssetTier(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceNum = Number(price ?? 0);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    if (!validatePrice(tier, priceNum)) {
      return NextResponse.json(
        { error: "Price does not match tier" },
        { status: 400 },
      );
    }

    if (
      !preview_url ||
      typeof preview_url !== "string" ||
      preview_url.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Preview URL is required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("assets")
      .insert({
        creator_id: user.id,
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim() : null,
        category,
        tier,
        price: priceNum,
        preview_url: preview_url.trim(),
        asset_url:
          typeof asset_url === "string" && asset_url.trim()
            ? asset_url.trim()
            : null,
        tags: Array.isArray(tags) ? tags : [],
        metadata: metadata ?? {},
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ asset: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
