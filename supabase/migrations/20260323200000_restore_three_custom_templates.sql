-- Restore required custom templates when missing.
-- Keeps existing rows untouched; inserts only absent names.

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select
  'Wolf King Caius',
  '狼人男主',
  array['pale', 'blonde', 'red-eyes', 'supernatural']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Wolf+King',
  'Athletic build, dark hair, wolf tattoo glowing on wrist, dark jacket, intense gaze, alpha presence。'
where not exists (
  select 1 from character_templates where name = 'Wolf King Caius'
);

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select
  'Sweet Girl Next Door',
  '甜美女主',
  array['natural', 'innocent', 'warm', 'approachable']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Sweet+Girl',
  'Warm approachable young woman, natural soft makeup, gentle smile, soft daylight, cozy modern setting, photorealistic.'
where not exists (
  select 1 from character_templates where name = 'Sweet Girl Next Door'
);

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select
  'Marcus',
  '反派使者',
  array['villain', 'messenger', 'dark', 'intense']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Marcus',
  'Dark messenger antagonist, sharp silhouette, threatening calm expression, cinematic contrast lighting.'
where not exists (
  select 1 from character_templates where name = 'Marcus'
);
