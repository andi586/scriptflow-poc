-- Targeted cleanup: keep only the newest row for specific templates that had
-- duplicated reference_image uploads.

with ranked as (
  select
    id,
    name,
    row_number() over (
      partition by lower(name)
      order by created_at desc, id desc
    ) as rn
  from character_templates
  where name in ('Marcus', 'Wolf King Caius', 'Sweet Girl Next Door')
)
delete from character_templates t
using ranked r
where t.id = r.id
  and r.rn > 1;
