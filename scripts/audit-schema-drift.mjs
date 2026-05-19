#!/usr/bin/env node
/**
 * Supabase schema drift audit.
 * Outputs: drift_report.md, missing_migrations.sql, unused_tables.md
 *
 * Usage: node scripts/audit-schema-drift.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

const STORAGE_BUCKETS = new Set([
  "recordings",
  "character-images",
  "generated-audio",
  "generated-videos",
  "music",
  "scriptflow-characters",
  "scene-videos",
]);

const CODE_GLOBS = ["ts", "tsx", "js", "mjs", "cjs"];

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
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
}

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", ".git", ".next"].includes(ent.name)) continue;
      walkDir(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

function extractMigrationTables() {
  const tables = new Map(); // table -> [migration files]
  const alterOnly = new Set();
  const functions = new Set();

  const reCreate =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
  const reAlter =
    /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
  const reFn =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;

  for (const file of fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    let m;
    reCreate.lastIndex = 0;
    while ((m = reCreate.exec(content))) {
      const t = m[1].toLowerCase();
      if (!tables.has(t)) tables.set(t, []);
      tables.get(t).push(file);
    }
    reAlter.lastIndex = 0;
    while ((m = reAlter.exec(content))) {
      alterOnly.add(m[1].toLowerCase());
    }
    reFn.lastIndex = 0;
    while ((m = reFn.exec(content))) {
      functions.add(m[1].toLowerCase());
    }
  }

  const created = new Set(tables.keys());
  const alterWithoutCreate = [...alterOnly].filter((t) => !created.has(t));

  return { tables, alterWithoutCreate, functions };
}

function extractCodeTables() {
  const refs = new Map(); // table -> Set<file>
  const rpcs = new Map();
  const reFrom = /\.from\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;
  const reRpc = /\.rpc\(\s*['"`]([a-zA-Z0-9_-]+)['"`]/g;

  const files = walkDir(ROOT).filter((f) => {
    const ext = path.extname(f).slice(1);
    if (!CODE_GLOBS.includes(ext)) return false;
    if (f.includes(`${path.sep}scripts${path.sep}audit-schema-drift.mjs`))
      return false;
    return true;
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, "utf8");
    let m;
    reFrom.lastIndex = 0;
    while ((m = reFrom.exec(content))) {
      const t = m[1];
      if (STORAGE_BUCKETS.has(t)) continue;
      if (!refs.has(t)) refs.set(t, new Set());
      refs.get(t).add(rel);
    }
    reRpc.lastIndex = 0;
    while ((m = reRpc.exec(content))) {
      if (!rpcs.has(m[1])) rpcs.set(m[1], new Set());
      rpcs.get(m[1]).add(rel);
    }
  }

  return { refs, rpcs, files: files.length };
}

async function fetchRemote() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { remoteTables: new Set(), openapi: {}, error: "Missing Supabase env" };
  }

  const openapiRes = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json",
    },
  });
  const openapi = openapiRes.ok ? await openapiRes.json() : {};
  const remoteTables = new Set(Object.keys(openapi.definitions ?? {}));

  const probe = async (table) => {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return r.status;
  };

  return { remoteTables, openapi, probe, url };
}

function pgTypeFromOpenAPI(prop) {
  if (!prop) return "TEXT";
  const fmt = prop.format ?? "";
  const type = prop.type ?? "string";
  if (fmt === "uuid") return "UUID";
  if (fmt === "integer") return "INTEGER";
  if (fmt === "bigint") return "BIGINT";
  if (fmt === "boolean") return "BOOLEAN";
  if (fmt === "jsonb" || type === "object") return "JSONB";
  if (fmt.includes("timestamp")) return "TIMESTAMPTZ";
  if (fmt === "text" || type === "string") return "TEXT";
  if (type === "number") return "NUMERIC";
  if (type === "array") return "TEXT[]";
  return "TEXT";
}

function buildCreateFromOpenAPI(table, openapi) {
  const def = openapi.definitions?.[table];
  if (!def?.properties) return null;
  const cols = [];
  const required = new Set(def.required ?? []);
  for (const [name, prop] of Object.entries(def.properties)) {
    let line = `  ${name} ${pgTypeFromOpenAPI(prop)}`;
    if (prop.default !== undefined) {
      const d = prop.default;
      if (d === "now()") line += " DEFAULT NOW()";
      else if (
        d === "gen_random_uuid()" ||
        (typeof d === "string" && d.includes("uuid_generate"))
      )
        line += " DEFAULT gen_random_uuid()";
      else if (typeof d === "string" && !d.includes("("))
        line += ` DEFAULT '${d}'`;
      else if (typeof d === "string" && d.includes("("))
        line += ""; // skip function-call defaults from OpenAPI
      else if (typeof prop.default === "boolean")
        line += ` DEFAULT ${prop.default}`;
      else if (typeof prop.default === "number")
        line += ` DEFAULT ${prop.default}`;
    }
    if (name === "id" && pgTypeFromOpenAPI(prop) === "UUID")
      line += " PRIMARY KEY";
    cols.push(line);
  }
  return `CREATE TABLE IF NOT EXISTS public.${table} (\n${cols.join(",\n")}\n);`;
}

// Hand-authored DDL for tables missing from OpenAPI (inferred from code types)
const HANDMADE_DDL = {
  profiles: `-- profiles: extends auth.users (required by Stripe webhook + credits)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 0,
  subscription_tier TEXT,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON public.profiles(credits);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
`,

  shots: `-- shots: episode pipeline (lib/orchestrators/episode-orchestrator.ts)
CREATE TABLE IF NOT EXISTS public.shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  kling_prompt TEXT NOT NULL DEFAULT '',
  kling_task_id TEXT,
  video_url TEXT,
  video_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, shot_index)
);
CREATE INDEX IF NOT EXISTS idx_shots_project_id ON public.shots(project_id);
`,

  dialogue_lines: `-- dialogue_lines: TTS pipeline per shot line
CREATE TABLE IF NOT EXISTS public.dialogue_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shot_index INTEGER NOT NULL,
  line_index INTEGER NOT NULL,
  character TEXT NOT NULL,
  text TEXT NOT NULL,
  emotion TEXT,
  voice_id TEXT NOT NULL DEFAULT '',
  audio_url TEXT,
  tts_status TEXT NOT NULL DEFAULT 'pending',
  start_sec NUMERIC,
  duration_sec NUMERIC,
  timestamps_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, shot_index, line_index)
);
CREATE INDEX IF NOT EXISTS idx_dialogue_lines_project_id ON public.dialogue_lines(project_id);
`,

  generation_runs: `-- generation_runs: tracks video/tts/merge job state per project
CREATE TABLE IF NOT EXISTS public.generation_runs (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  video_status TEXT NOT NULL DEFAULT 'pending',
  tts_status TEXT NOT NULL DEFAULT 'pending',
  merge_status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  merge_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`,

  movie_shots: `-- movie_shots: only ALTER migrations exist in repo; CREATE from remote OpenAPI snapshot
CREATE TABLE IF NOT EXISTS public.movie_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID,
  shot_index INTEGER,
  omni_task_id TEXT,
  kling_task_id TEXT,
  omni_video_url TEXT,
  kling_scene_url TEXT,
  final_shot_url TEXT,
  audio_url TEXT,
  status TEXT DEFAULT 'pending',
  shotstack_render_id TEXT,
  narrative JSONB,
  shot_type TEXT DEFAULT 'face',
  duration NUMERIC,
  retry_count INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  error TEXT,
  user_id UUID,
  twin_frame_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_movie_shots_status_updated_at ON public.movie_shots(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_movie_shots_movie_id ON public.movie_shots(movie_id);
`,

  kling_jobs_columns: `-- kling_jobs: code expects columns beyond remote schema (process-kling route)
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS scene_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS result_video_url TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS shotstack_render_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.kling_jobs ADD COLUMN IF NOT EXISTS prompt TEXT;
`,

  omnihuman_jobs_columns: `-- omnihuman_jobs: align migration file with production columns
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS kling_task_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS keyframe_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS scene_task_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS scene_video_url TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS shotstack_render_id TEXT;
ALTER TABLE public.omnihuman_jobs ADD COLUMN IF NOT EXISTS user_id UUID;
`,

  movies_columns: `-- movies: columns used in app but not in 20260416 migration
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS story_input TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS twin_photo_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS twin_video_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard';
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS primary_emotion TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS kling_task_id TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS hook_video_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS template_id TEXT;
`,
};

function readMigrationFile(name) {
  const p = path.join(MIGRATIONS_DIR, name);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

async function main() {
  loadEnv();
  const { tables: migrationTables, alterWithoutCreate, functions } =
    extractMigrationTables();
  const { refs: codeRefs, rpcs, files: codeFileCount } = extractCodeTables();
  const { remoteTables, openapi, probe, url, error } = await fetchRemote();

  const migrationSet = new Set(migrationTables.keys());
  const codeSet = new Set(codeRefs.keys());
  const allTables = new Set([...migrationSet, ...codeSet, ...remoteTables]);

  const codeNotInMigration = [...codeSet]
    .filter((t) => !migrationSet.has(t))
    .sort();
  const migrationNotOnRemote = [...migrationSet]
    .filter((t) => remoteTables.size && !remoteTables.has(t))
    .sort();
  const codeNotOnRemote = [...codeSet]
    .filter((t) => remoteTables.size && !remoteTables.has(t))
    .sort();
  const remoteNotInCode = [...remoteTables]
    .filter((t) => !codeSet.has(t))
    .sort();
  const migrationUnused = [...migrationSet]
    .filter((t) => !codeSet.has(t))
    .sort();

  // Column drift: kling_jobs code vs remote
  const klingJobCodeCols = new Set([
    "scene_video_url",
    "result_video_url",
    "shotstack_render_id",
    "task_id",
    "updated_at",
    "prompt",
    "status",
    "kling_task_id",
  ]);
  const klingRemoteCols = new Set(
    Object.keys(openapi.definitions?.kling_jobs?.properties ?? {}),
  );
  const klingMissingOnRemote = [...klingJobCodeCols].filter(
    (c) => !klingRemoteCols.has(c),
  );

  const sqlParts = [];
  sqlParts.push(`-- missing_migrations.sql`);
  sqlParts.push(`-- Generated: ${new Date().toISOString()}`);
  sqlParts.push(`-- Target: ${url ?? "N/A"}`);
  sqlParts.push(`-- Apply via: npm run db:migrate (DATABASE_URL) or Supabase SQL editor`);
  sqlParts.push("");

  sqlParts.push("-- =============================================================================");
  sqlParts.push("-- SECTION A: Existing repo migrations not yet applied on remote");
  sqlParts.push("-- =============================================================================");
  for (const t of migrationNotOnRemote) {
    const files = migrationTables.get(t) ?? [];
    for (const f of files) {
      const body = readMigrationFile(f);
      if (body) {
        sqlParts.push(`-- >>> from ${f}`);
        sqlParts.push(body.trim());
        sqlParts.push("");
      }
    }
  }

  sqlParts.push("-- =============================================================================");
  sqlParts.push("-- SECTION B: Tables referenced in code but missing CREATE in supabase/migrations/");
  sqlParts.push("-- =============================================================================");

  for (const t of codeNotInMigration) {
    if (t === "kling_jobs") {
      sqlParts.push(
        "-- kling_jobs: table exists on remote; see SECTION C for column ALTERs only",
      );
      continue;
    }
    if (HANDMADE_DDL[t]) {
      sqlParts.push(HANDMADE_DDL[t]);
      continue;
    }
    if (remoteTables.has(t)) {
      const ddl = buildCreateFromOpenAPI(t, openapi);
      if (ddl) {
        sqlParts.push(`-- Snapshot from remote OpenAPI (${t})`);
        sqlParts.push(ddl);
        sqlParts.push("");
        continue;
      }
    }
    sqlParts.push(`-- TODO: ${t} — no OpenAPI snapshot; add CREATE manually`);
    sqlParts.push("");
  }

  sqlParts.push("-- =============================================================================");
  sqlParts.push("-- SECTION C: ALTER-only tables / column alignment");
  sqlParts.push("-- =============================================================================");
  for (const key of [
    "movie_shots",
    "kling_jobs_columns",
    "omnihuman_jobs_columns",
    "movies_columns",
  ]) {
    if (HANDMADE_DDL[key]) sqlParts.push(HANDMADE_DDL[key]);
  }

  sqlParts.push("-- =============================================================================");
  sqlParts.push("-- SECTION D: Functions from migrations (depend on emotion_lines, profiles)");
  sqlParts.push("-- =============================================================================");
  const boostFn = readMigrationFile(
    "20260510_create_boost_emotion_lines_function.sql",
  );
  if (boostFn) sqlParts.push(boostFn.trim(), "");
  const creditsFn = readMigrationFile("add_user_credits.sql");
  if (creditsFn) sqlParts.push(creditsFn.trim(), "");

  fs.writeFileSync(path.join(ROOT, "missing_migrations.sql"), sqlParts.join("\n"));

  // drift_report.md
  const lines = [];
  lines.push("# Supabase Schema Drift Report");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Project URL:** ${url ?? "_not configured_"}`);
  lines.push(`**Code files scanned:** ${codeFileCount}`);
  lines.push(`**Migration files:** ${fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).length}`);
  lines.push(`**Tables in migrations (CREATE):** ${migrationSet.size}`);
  lines.push(`**Tables referenced in code:** ${codeSet.size}`);
  lines.push(`**Tables on remote (OpenAPI):** ${remoteTables.size}`);
  if (error) lines.push(`\n> ⚠️ ${error}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Category | Count |");
  lines.push("|----------|------:|");
  lines.push(`| Code references without CREATE migration | ${codeNotInMigration.length} |`);
  lines.push(`| Migrations not on remote | ${migrationNotOnRemote.length} |`);
  lines.push(`| Code tables missing on remote | ${codeNotOnRemote.length} |`);
  lines.push(`| Remote tables unused in code | ${remoteNotInCode.length} |`);
  lines.push(`| Migration tables unused in code | ${migrationUnused.length} |`);
  lines.push(`| ALTER-only in migrations (no CREATE) | ${alterWithoutCreate.length} |`);
  lines.push("");

  lines.push("## 1. Code references without migration CREATE");
  lines.push("");
  lines.push(
    "These tables are used via `.from('...')` but have no `CREATE TABLE` in `supabase/migrations/`.",
  );
  lines.push("");
  if (codeNotInMigration.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Table | On remote | Sample files |");
    lines.push("|-------|-----------|--------------|");
    for (const t of codeNotInMigration) {
      const onRemote = remoteTables.has(t) ? "✅" : "❌";
      const files = [...(codeRefs.get(t) ?? [])].slice(0, 3).join(", ");
      lines.push(`| \`${t}\` | ${onRemote} | ${files} |`);
    }
  }
  lines.push("");

  lines.push("## 2. Migrations not applied on remote");
  lines.push("");
  if (migrationNotOnRemote.length === 0) {
    lines.push("_All migration-defined tables exist on remote._");
  } else {
    lines.push("| Table | Migration file(s) |");
    lines.push("|-------|-------------------|");
    for (const t of migrationNotOnRemote) {
      const files = (migrationTables.get(t) ?? []).join(", ");
      lines.push(`| \`${t}\` | ${files} |`);
    }
  }
  lines.push("");

  lines.push("## 3. Code tables missing on remote");
  lines.push("");
  if (codeNotOnRemote.length === 0) {
    lines.push("_All code-referenced tables exist on remote._");
  } else {
    for (const t of codeNotOnRemote) {
      const files = [...(codeRefs.get(t) ?? [])].slice(0, 5);
      lines.push(`- **\`${t}\`** — ${files.join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## 4. Column-level drift");
  lines.push("");
  lines.push("### `kling_jobs`");
  lines.push("");
  lines.push(
    "`app/api/cron/process-kling/route.ts` reads/writes columns that are **not** on the remote table:",
  );
  lines.push("");
  lines.push(`- Missing on remote: ${klingMissingOnRemote.map((c) => `\`${c}\``).join(", ") || "_none_"}`);
  lines.push(`- Remote columns: ${[...klingRemoteCols].join(", ")}`);
  lines.push("");
  lines.push("### `profiles`");
  lines.push("");
  lines.push(
    "`add_user_credits.sql` alters `profiles`, but the table does not exist on remote. Stripe webhook and credits page will fail until `profiles` is created.",
  );
  lines.push("");

  lines.push("## 5. ALTER-only tables (no CREATE in migrations)");
  lines.push("");
  for (const t of alterWithoutCreate.sort()) {
    const inCode = codeSet.has(t) ? "referenced in code" : "not referenced in code";
    const onRemote = remoteTables.has(t) ? "exists on remote" : "missing on remote";
    lines.push(`- \`${t}\` — ${inCode}; ${onRemote}`);
  }
  lines.push("");

  lines.push("## 6. RPC functions");
  lines.push("");
  lines.push("| Function | In migrations | Called from code |");
  lines.push("|----------|---------------|------------------|");
  const rpcNames = new Set([...functions, ...rpcs.keys()]);
  for (const fn of [...rpcNames].sort()) {
    const mig = functions.has(fn) ? "✅" : "—";
    const code = rpcs.has(fn)
      ? [...rpcs.get(fn)].slice(0, 2).join(", ")
      : "—";
    lines.push(`| \`${fn}\` | ${mig} | ${code} |`);
  }
  lines.push("");

  lines.push("## 7. Recommended actions");
  lines.push("");
  lines.push("1. Review and apply `missing_migrations.sql` on staging first.");
  lines.push("2. Add versioned files under `supabase/migrations/` for Section B tables (copy from generated SQL).");
  lines.push("3. Run `npm run db:migrate` with `DATABASE_URL` set in `.env.local` for repeatable deploys.");
  lines.push("4. Fix `kling_jobs` column drift before relying on `process-kling` cron.");
  lines.push("5. Create `profiles` before Stripe credit webhooks.");
  lines.push("");

  fs.writeFileSync(path.join(ROOT, "drift_report.md"), lines.join("\n"));

  // unused_tables.md
  const unused = [];
  unused.push("# Unused Supabase Tables");
  unused.push("");
  unused.push(`**Generated:** ${new Date().toISOString()}`);
  unused.push("");
  unused.push(
    "Tables defined in migrations or present on remote but **never** referenced via `.from('table')` in application code (excluding scripts that only seed/migrate).",
  );
  unused.push("");

  unused.push("## Migration tables not referenced in code");
  unused.push("");
  if (migrationUnused.length === 0) {
    unused.push("_All migration tables are referenced._");
  } else {
    unused.push("| Table | Migration file(s) | On remote |");
    unused.push("|-------|---------------------|-----------|");
    for (const t of migrationUnused) {
      const files = (migrationTables.get(t) ?? []).join(", ");
      const onRemote = remoteTables.has(t) ? "✅" : "❌";
      unused.push(`| \`${t}\` | ${files} | ${onRemote} |`);
    }
  }
  unused.push("");

  unused.push("## Remote tables not referenced in code");
  unused.push("");
  unused.push(
    "_May be legacy, dashboard-only, or reserved for future features. Verify before dropping._",
  );
  unused.push("");
  if (remoteNotInCode.length === 0) {
    unused.push("_None._");
  } else {
    unused.push("| Table | Notes |");
    unused.push("|-------|-------|");
    for (const t of remoteNotInCode) {
      const inMig = migrationSet.has(t) ? "in migrations" : "remote-only (no CREATE migration)";
      unused.push(`| \`${t}\` | ${inMig} |`);
    }
  }
  unused.push("");

  unused.push("## Storage buckets (not SQL tables)");
  unused.push("");
  unused.push(
    [...STORAGE_BUCKETS].map((b) => `- \`${b}\``).join("\n"),
  );
  unused.push("");

  fs.writeFileSync(path.join(ROOT, "unused_tables.md"), unused.join("\n"));

  console.log("Wrote drift_report.md, missing_migrations.sql, unused_tables.md");
  console.log({
    codeNotInMigration: codeNotInMigration.length,
    migrationNotOnRemote: migrationNotOnRemote.length,
    codeNotOnRemote: codeNotOnRemote.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
