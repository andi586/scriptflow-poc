# Unused Supabase Tables

**Generated:** 2026-05-19T01:42:25.037Z

Tables defined in migrations or present on remote but **never** referenced via `.from('table')` in application code (excluding scripts that only seed/migrate).

## Migration tables not referenced in code

| Table | Migration file(s) | On remote |
|-------|---------------------|-----------|
| `beats` | 20260319000001_initial_schema.sql | ✅ |
| `creator_assets` | 20260328000004_creator_economy.sql | ✅ |
| `expression_assets` | 20260507_create_expression_assets.sql | ❌ |
| `fund_award_performance` | 20260328000004_creator_economy.sql | ✅ |
| `generation_tasks` | 20260319000001_initial_schema.sql | ✅ |
| `nel_personal_models` | 20260328000004_creator_economy.sql | ✅ |
| `novelty_manual_scores` | 20260328000004_creator_economy.sql | ✅ |
| `platform_config` | 20260329000002_platform_config.sql | ✅ |
| `review_committee_logs` | 20260328000004_creator_economy.sql | ✅ |
| `script_characters` | 20260326000001_script_creation.sql | ✅ |

## Remote tables not referenced in code

_May be legacy, dashboard-only, or reserved for future features. Verify before dropping._

| Table | Notes |
|-------|-------|
| `asset_purchases` | remote-only (no CREATE migration) |
| `beats` | in migrations |
| `creator_assets` | in migrations |
| `emotion_queue` | remote-only (no CREATE migration) |
| `emotion_quotes` | remote-only (no CREATE migration) |
| `emotion_structures` | remote-only (no CREATE migration) |
| `fund_award_performance` | in migrations |
| `generation_tasks` | in migrations |
| `nel_personal_models` | in migrations |
| `novelty_manual_scores` | in migrations |
| `platform_config` | in migrations |
| `review_committee_logs` | in migrations |
| `script_characters` | in migrations |
| `twin_emotion_clips` | remote-only (no CREATE migration) |

## Storage buckets (not SQL tables)

- `recordings`
- `character-images`
- `generated-audio`
- `generated-videos`
- `music`
- `scriptflow-characters`
- `scene-videos`
