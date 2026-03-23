-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- Protected records: Wolf King Caius / Sweet Girl Next Door / Marcus must never be deleted by dedupe.
-- Keep migration idempotent without deleting protected rows.
select 1;

-- Prevent future duplicates for these three names regardless of archetype.
create unique index if not exists idx_character_templates_three_names_unique
  on character_templates (lower(name))
  where lower(name) in (
    lower('Marcus'),
    lower('Wolf King Caius'),
    lower('Sweet Girl Next Door')
  );
