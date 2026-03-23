-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- Protected records: Wolf King Caius / Sweet Girl Next Door / Marcus are protected and must never be deduped/deleted automatically.
-- This migration is intentionally a no-op now to prevent accidental data loss.

with ranked as (
  select
    id,
    name,
    row_number() over (
      partition by lower(name)
      order by created_at desc, id desc
    ) as rn
  from character_templates
  where 1 = 0
)
delete from character_templates t
using ranked r
where t.id = r.id
  and r.rn > 1;
