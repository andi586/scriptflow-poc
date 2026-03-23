-- Keep newest row for three critical templates, dedupe by character name only.
with ranked as (
  select
    id,
    name,
    row_number() over (
      partition by lower(name)
      order by created_at desc, id desc
    ) as rn
  from character_templates
  where lower(name) in (
    lower('Marcus'),
    lower('Wolf King Caius'),
    lower('Sweet Girl Next Door')
  )
)
delete from character_templates t
using ranked r
where t.id = r.id
  and r.rn > 1;

-- Prevent future duplicates for these three names regardless of archetype.
create unique index if not exists idx_character_templates_three_names_unique
  on character_templates (lower(name))
  where lower(name) in (
    lower('Marcus'),
    lower('Wolf King Caius'),
    lower('Sweet Girl Next Door')
  );
