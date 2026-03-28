import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/assets/[id]/purchase
 * Purchase an asset
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check if asset exists and is active
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (assetError) throw assetError;
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 2. Check if already purchased
    const { data: existing } = await supabase
      .from("user_assets")
      .select("id")
      .eq("user_id", user.id)
      .eq("asset_id", id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Asset already purchased" },
        { status: 400 },
      );
    }

    // 3. Check if exclusive and already locked
    if (asset.tier === "exclusive") {
      const { data: exclusiveLock } = await supabase
        .from("asset_exclusivity")
        .select("owner_user_id")
        .eq("asset_id", id)
        .maybeSingle();

      if (exclusiveLock) {
        return NextResponse.json(
          { error: "Exclusive asset already purchased by another user" },
          { status: 400 },
        );
      }
    }

    // 4. Insert purchase record (trigger will handle exclusivity lock)
    const { data: purchase, error: purchaseError } = await supabase
      .from("user_assets")
      .insert({
        user_id: user.id,
        asset_id: id,
        price_paid: asset.price,
        transaction_id: `txn_${Date.now()}_${user.id.slice(0, 8)}`,
      })
      .select()
      .single();

    if (purchaseError) {
      // Check if it's the exclusivity constraint error
      if (
        purchaseError.message.includes("Exclusive asset already purchased")
      ) {
        return NextResponse.json(
          { error: "Exclusive asset already purchased by another user" },
          { status: 400 },
        );
      }
      throw purchaseError;
    }

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
