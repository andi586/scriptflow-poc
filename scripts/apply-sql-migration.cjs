/**
 * Apply a raw SQL migration file using Postgres (Supabase).
 * Requires DATABASE_URL in .env.local (Dashboard → Project Settings → Database → URI).
 * Usage: node scripts/apply-sql-migration.cjs [path/to/file.sql]
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal(root) {
  try {
    const envPath = path.join(root, ".env.local");
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
    // ignore
  }
}

const root = path.resolve(__dirname, "..");
loadEnvLocal(root);

const rel =
  process.argv[2] ||
  "supabase/migrations/20260321000003_kling_tasks_project_id.sql";
const sqlPath = path.isAbsolute(rel) ? rel : path.join(root, rel);
const sql = fs.readFileSync(sqlPath, "utf8");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL. Copy the connection URI from Supabase → Settings → Database → Connection string (use pooler or direct, with percent-encoded password).",
  );
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
  console.log("Applied:", path.relative(root, sqlPath));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
