import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/assets/my
 * Get current user's purchased assets
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's purchases with asset details
    const { data: userAssets, error } = await supabase
      .from("user_assets")
      .select(
        `
        id,
        purchased_at,
        price_paid,
        asset:assets (
          id,
          name,
          description,
          category,
          tier,
          price,
          preview_url,
          asset_url,
          tags,
          metadata,
          created_at
        )
      `,
      )
      .eq("user_id", user.id)
      .order("purchased_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ purchases: userAssets ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
