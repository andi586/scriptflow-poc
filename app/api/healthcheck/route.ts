import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type HealthStatus = "ok" | "error";

type HealthBody = {
  anthropic: HealthStatus;
  piapi: HealthStatus;
  supabase: HealthStatus;
  errors: Record<string, string>;
};

export async function GET() {
  const errors: Record<string, string> = {};
  let anthropic: HealthStatus = "error";
  let piapi: HealthStatus = "error";
  let supabaseStatus: HealthStatus = "error";

  // --- Anthropic: minimal messages call ---
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("Missing OPENROUTER_API_KEY");
    const client = new Anthropic({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://getscriptflow.com',
        'X-Title': 'ScriptFlow'
      }
    });
    await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    });
    anthropic = "ok";
  } catch (e) {
    errors.anthropic = e instanceof Error ? e.message : JSON.stringify(e);
  }

  // --- PiAPI: account / balance (lightweight) ---
  try {
    const base = process.env.KLING_API_BASE;
    const key = process.env.KLING_API_KEY;
    if (!base) throw new Error("Missing KLING_API_BASE");
    if (!key) throw new Error("Missing KLING_API_KEY");

    const origin = new URL(base).origin;
    const candidates = [
      `${origin}/account/info`,
      `${origin}/api/v1/account/info`,
    ];

    let lastStatus = 0;
    let lastText = "";
    // PiAPI OpenAPI uses `x-api-key` only. Sending both `X-API-Key` and `x-api-key`
    // breaks verification (401) on some runtimes (Undici merges duplicate semantics).
    for (const url of candidates) {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-api-key": key,
        },
      });
      lastStatus = res.status;
      lastText = await res.text();
      if (res.ok) {
        piapi = "ok";
        break;
      }
    }
    if (piapi !== "ok") {
      throw new Error(`PiAPI account check failed: ${lastStatus} ${lastText.slice(0, 200)}`);
    }
  } catch (e) {
    errors.piapi = e instanceof Error ? e.message : JSON.stringify(e);
  }

  // --- Supabase: simple read ---
  try {
    const client = createClient();
    const { error } = await client.from("projects").select("id").limit(1);
    if (error) throw error;
    supabaseStatus = "ok";
  } catch (e) {
    errors.supabase = e instanceof Error ? e.message : JSON.stringify(e);
  }

  const body: HealthBody = {
    anthropic,
    piapi,
    supabase: supabaseStatus,
    errors,
  };

  return NextResponse.json(body);
}
