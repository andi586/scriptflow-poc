-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- Protected records: Wolf King Caius / Sweet Girl Next Door / Marcus.
-- These three rows must never be deleted and their reference_image_url must never be cleared.

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base, project_id)
values
  ('Wolf King Caius', '狼人男主', array['wolf', 'alpha', 'dark', 'intense']::text[],
   'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Wolf+King+Caius',
   'Athletic build, dark hair, wolf tattoo glowing on wrist, dark jacket, intense gaze, alpha presence。', null),
  ('Sweet Girl Next Door', '甜美女主', array['natural', 'innocent', 'warm', 'approachable']::text[],
   'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Sweet+Girl',
   'Warm approachable young woman, natural soft makeup, gentle smile, soft daylight, cozy modern setting, photorealistic.', null),
  ('Marcus', '反派使者', array['villain', 'messenger', 'dark', 'intense']::text[],
   'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Marcus',
   'Dark messenger antagonist, sharp silhouette, threatening calm expression, cinematic contrast lighting.', null)
on conflict do nothing;

create or replace function protect_core_character_templates()
returns trigger
language plpgsql
as $$
begin
  if lower(coalesce(old.name, new.name, '')) not in (
    lower('Wolf King Caius'),
    lower('Sweet Girl Next Door'),
    lower('Marcus')
  ) then
    return coalesce(new, old);
  end if;

  if coalesce(old.project_id, new.project_id) is not null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Protected template cannot be deleted: %', old.name;
  end if;

  if tg_op = 'UPDATE' and coalesce(trim(new.reference_image_url), '') = '' then
    raise exception 'Protected template reference_image_url cannot be empty: %', old.name;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_core_character_templates on character_templates;
create trigger trg_protect_core_character_templates
before update or delete on character_templates
for each row execute function protect_core_character_templates();
