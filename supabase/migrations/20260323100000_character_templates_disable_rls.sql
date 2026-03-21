-- Character templates API uses NEXT_PUBLIC_SUPABASE_ANON_KEY only (no service_role).
-- With RLS off, anon JWT can INSERT/UPDATE from trusted server routes; lock down via API validation.
alter table character_templates disable row level security;
