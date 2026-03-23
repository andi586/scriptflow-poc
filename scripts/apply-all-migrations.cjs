/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Apply pending SQL files under supabase/migrations/ to Postgres (Supabase).
 * Tracks applied files in _scriptflow_migrations so re-runs are safe.
 * After new migrations, sends NOTIFY pgrst to refresh PostgREST schema cache.
 *
 * Requires DATABASE_URL (Supabase → Settings → Database → URI, use pooler or direct).
 *
 * Usage (CI installs only pg, then runs this script directly):
 *   npm run db:migrate
 *   DATABASE_URL=postgres://... node scripts/apply-all-migrations.cjs
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvFromFile(envPath) {
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
    // ignore
  }
}

const root = path.resolve(__dirname, "..");
loadEnvFromFile(path.join(root, ".env.local"));
loadEnvFromFile(path.join(root, ".env"));

const migrationsDir = path.join(root, "supabase", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL. Set it in .env.local or the environment (Supabase → Settings → Database → Connection string).",
  );
  process.exit(1);
}

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  let anyNew = false;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _scriptflow_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows: appliedRows } = await client.query(
      "SELECT filename FROM _scriptflow_migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log("[skip]", file);
        continue;
      }

      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, "utf8");
      if (!sql.trim()) {
        console.log("[empty]", file);
        await client.query(
          "INSERT INTO _scriptflow_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
          [file],
        );
        continue;
      }

      console.log("[apply]", file);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _scriptflow_migrations (filename) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        anyNew = true;
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("Failed while applying:", file);
        throw e;
      }
    }

    if (anyNew) {
      try {
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("[notify] PostgREST schema reload requested.");
      } catch (e) {
        console.warn("[warn] NOTIFY pgrst failed (non-fatal):", e.message || e);
      }
    } else {
      console.log("No pending migrations.");
    }
  } finally {
    await client.end();
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error("[db:migrate] failed:", e.message || e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
