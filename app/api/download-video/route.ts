import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw?.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only https URLs are allowed" }, { status: 400 });
  }

  const upstream = await fetch(raw, {
    method: "GET",
    headers: { Accept: "video/*,*/*" },
    redirect: "follow",
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }

  const body = upstream.body;
  if (!body) {
    return NextResponse.json({ error: "Empty upstream body" }, { status: 502 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="scene.mp4"',
      "Cache-Control": "private, no-store",
    },
  });
}
