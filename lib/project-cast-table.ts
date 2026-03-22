/**
 * Supabase table used for per-project cast (template binds + uploads).
 * Rows with `project_id IS NULL` are global library templates; bound rows set `project_id`.
 */
export const PROJECT_CAST_TABLE = "character_templates" as const;
