-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- Protected records: Wolf King Caius / Sweet Girl Next Door / Marcus must never be deleted by dedupe.
-- Prevent duplicate template rows for the same character identity.
-- Keep newest row per (name, archetype), delete older duplicates, then enforce uniqueness.

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(name), lower(archetype)
      order by created_at desc, id desc
    ) as rn
  from character_templates
  where lower(name) not in (
    lower('Wolf King Caius'),
    lower('Sweet Girl Next Door'),
    lower('Marcus')
  )
)
delete from character_templates t
using ranked r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists idx_character_templates_name_archetype_unique
  on character_templates (lower(name), lower(archetype));
