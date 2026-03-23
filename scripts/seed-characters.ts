import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type SeedRow = {
  name: string;
  archetype: string;
  style_tags: string[];
  reference_image_url: string;
  kling_prompt_base: string;
};

function loadEnvFromFile(envPath: string) {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // ignore missing env files
  }
}

const root = path.resolve(__dirname, "..");
loadEnvFromFile(path.join(root, ".env.local"));
loadEnvFromFile(path.join(root, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rows: SeedRow[] = [
  {
    name: "Wolf King Caius",
    archetype: "狼人男主",
    style_tags: ["wolf", "alpha", "dark", "intense"],
    reference_image_url: "https://placehold.co/400x600/0a0a0a/d4a574/png?text=Wolf+King+Caius",
    kling_prompt_base:
      "Athletic build, dark hair, wolf tattoo glowing on wrist, dark jacket, intense gaze, alpha presence。",
  },
  {
    name: "Sweet Girl Next Door",
    archetype: "甜美女主",
    style_tags: ["natural", "innocent", "warm", "approachable"],
    reference_image_url: "https://placehold.co/400x600/0a0a0a/d4a574/png?text=Sweet+Girl",
    kling_prompt_base:
      "Warm approachable young woman, natural soft makeup, gentle smile, soft daylight, cozy modern setting, photorealistic.",
  },
  {
    name: "Marcus",
    archetype: "反派使者",
    style_tags: ["villain", "messenger", "dark", "intense"],
    reference_image_url: "https://placehold.co/400x600/0a0a0a/d4a574/png?text=Marcus",
    kling_prompt_base:
      "Dark messenger antagonist, sharp silhouette, threatening calm expression, cinematic contrast lighting.",
  },
];

async function main() {
  const names = rows.map((r) => r.name);
  const { data: beforeRows, error: beforeError } = await supabase
    .from("character_templates")
    .select("id,name,archetype,created_at")
    .in("name", names)
    .is("project_id", null)
    .order("created_at", { ascending: true });
  if (beforeError) throw beforeError;

  console.log("[before]", beforeRows?.length ?? 0, "matching library rows");

  const existingKey = new Set(
    (beforeRows ?? []).map((r) => `${r.name.toLowerCase()}::${r.archetype.toLowerCase()}`),
  );
  const rowsToInsert = rows.filter(
    (r) => !existingKey.has(`${r.name.toLowerCase()}::${r.archetype.toLowerCase()}`),
  );

  let insertedNow = 0;
  if (rowsToInsert.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("character_templates")
      .insert(rowsToInsert)
      .select("id,name,archetype");
    if (insertError) throw insertError;
    insertedNow = insertedRows?.length ?? 0;
  }

  const { data: afterRows, error: afterError } = await supabase
    .from("character_templates")
    .select("id,name,archetype,created_at")
    .in("name", names)
    .is("project_id", null)
    .order("created_at", { ascending: true });
  if (afterError) throw afterError;

  console.log("[inserted_now]", insertedNow);
  console.log("[after]", afterRows?.length ?? 0, "matching library rows");
  console.log(
    "[rows]",
    (afterRows ?? []).map((r) => `${r.name} (${r.archetype})`).join(", "),
  );
}

main().catch((e) => {
  console.error("[seed-characters] failed:", e?.message || e);
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
