# Supabase Schema Drift Report

**Generated:** 2026-05-19T01:42:25.037Z
**Project URL:** https://ktrtheitjtwpdvdvnlzj.supabase.co
**Code files scanned:** 264
**Migration files:** 45
**Tables in migrations (CREATE):** 32
**Tables referenced in code:** 40
**Tables on remote (OpenAPI):** 49

## Summary

| Category | Count |
|----------|------:|
| Code references without CREATE migration | 18 |
| Migrations not on remote | 2 |
| Code tables missing on remote | 5 |
| Remote tables unused in code | 14 |
| Migration tables unused in code | 10 |
| ALTER-only in migrations (no CREATE) | 2 |

## 1. Code references without migration CREATE

These tables are used via `.from('...')` but have no `CREATE TABLE` in `supabase/migrations/`.

| Table | On remote | Sample files |
|-------|-----------|--------------|
| `dialogue_blocks` | ✅ | app/api/pipeline/finalize/route.ts |
| `dialogue_lines` | ❌ | lib/orchestrators/episode-orchestrator.ts |
| `digital_twins` | ✅ | app/api/create-movie/route.ts, app/api/digital-twin/create/route.ts, app/api/hook/generate/route.ts |
| `director_rules` | ✅ | app/api/emotion/generate-hook/route.ts, app/lib/cognitive-core.ts |
| `emotion_details` | ✅ | app/api/emotion/generate-hook/route.ts, app/api/generate-script/route.ts |
| `emotion_lines` | ✅ | app/api/emotion/generate-hook/route.ts, app/api/generate-script/route.ts |
| `emotional_memory` | ✅ | app/api/movie/generate/route.ts |
| `generation_runs` | ❌ | lib/orchestrators/episode-orchestrator.ts |
| `hook_experiments` | ✅ | app/api/emotion/generate-hook/route.ts |
| `kling_jobs` | ✅ | app/api/cron/process-kling/route.ts |
| `market_assets` | ✅ | app/api/market-assets/route.ts |
| `market_feedback` | ✅ | app/api/analytics/feedback/route.ts, app/api/analytics/watch/route.ts |
| `movie_shots` | ✅ | app/api/admin/concat-movie/route.ts, app/api/cron/orchestrator/route.ts, app/api/cron/process-movies/route.ts |
| `music_assets` | ✅ | app/lib/bgm-selector-v2.ts, app/lib/music-selector.ts |
| `profiles` | ❌ | app/api/stripe/checkout/route.ts, app/api/stripe/webhook/route.ts, app/credits/page.tsx |
| `push_subscriptions` | ✅ | app/api/push/send/route.ts, app/api/push/subscribe/route.ts |
| `script_edits` | ✅ | app/api/pipeline/finalize/route.ts |
| `shots` | ❌ | lib/orchestrators/episode-orchestrator.ts |

## 2. Migrations not applied on remote

| Table | Migration file(s) |
|-------|-------------------|
| `expression_assets` | 20260507_create_expression_assets.sql |
| `payments` | 20260509_create_payments_table.sql |

## 3. Code tables missing on remote

- **`dialogue_lines`** — lib/orchestrators/episode-orchestrator.ts
- **`generation_runs`** — lib/orchestrators/episode-orchestrator.ts
- **`payments`** — app/api/stripe/webhook/route.ts
- **`profiles`** — app/api/stripe/checkout/route.ts, app/api/stripe/webhook/route.ts, app/credits/page.tsx
- **`shots`** — lib/orchestrators/episode-orchestrator.ts

## 4. Column-level drift

### `kling_jobs`

`app/api/cron/process-kling/route.ts` reads/writes columns that are **not** on the remote table:

- Missing on remote: `scene_video_url`, `result_video_url`, `shotstack_render_id`, `task_id`, `updated_at`
- Remote columns: id, movie_id, shot_index, prompt, status, kling_task_id, result_url, created_at

### `profiles`

`add_user_credits.sql` alters `profiles`, but the table does not exist on remote. Stripe webhook and credits page will fail until `profiles` is created.

## 5. ALTER-only tables (no CREATE in migrations)

- `movie_shots` — referenced in code; exists on remote
- `profiles` — referenced in code; missing on remote

## 6. RPC functions

| Function | In migrations | Called from code |
|----------|---------------|------------------|
| `boost_emotion_lines` | ✅ | app/api/analytics/feedback/route.ts |
| `enforce_exclusive_purchase` | ✅ | — |
| `exec_sql` | — | scripts/run_f83.mjs, scripts/run_f83_tables2.mjs |
| `handle_asset_updated_at` | ✅ | — |
| `increment_user_credits` | ✅ | app/api/stripe/webhook/route.ts, app/api/survey/submit/route.ts |
| `protect_core_character_templates` | ✅ | — |
| `update_script_updated_at` | ✅ | — |
| `update_updated_at` | ✅ | — |

## 7. Recommended actions

1. Review and apply `missing_migrations.sql` on staging first.
2. Add versioned files under `supabase/migrations/` for Section B tables (copy from generated SQL).
3. Run `npm run db:migrate` with `DATABASE_URL` set in `.env.local` for repeatable deploys.
4. Fix `kling_jobs` column drift before relying on `process-kling` cron.
5. Create `profiles` before Stripe credit webhooks.
