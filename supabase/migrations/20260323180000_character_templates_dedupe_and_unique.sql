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
)
delete from character_templates t
using ranked r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists idx_character_templates_name_archetype_unique
  on character_templates (lower(name), lower(archetype));
