-- Enables UPSERT on conflict (name) for library seed rows: Caius, Luna, Marcus.
create unique index if not exists idx_character_templates_seed_caius_luna_marcus_name
  on character_templates (name)
  where project_id is null
    and name in ('Caius', 'Luna', 'Marcus');
