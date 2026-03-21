-- F63/F64: Character template library (DB-backed)

create extension if not exists "pgcrypto";

create table if not exists character_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  archetype text not null,
  style_tags text[] not null default '{}',
  reference_image_url text not null,
  kling_prompt_base text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_character_templates_created_at on character_templates (created_at desc);

alter table character_templates enable row level security;

create policy "character_templates_select_public"
  on character_templates
  for select
  using (true);

-- Seed 6 templates (placeholder images); idempotent by name
insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'CEO Alpha Male', '霸总男主',
  array['suit', 'cold', 'western', 'alpha']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=CEO+Alpha',
  'Sharp tailored black suit, cold alpha male executive, authoritative posture, cinematic office lighting, photorealistic.'
where not exists (select 1 from character_templates where name = 'CEO Alpha Male');

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'Wolf King Caius', '狼人男主',
  array['pale', 'blonde', 'red-eyes', 'supernatural']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Wolf+King',
  'Pale skin, blond hair, faint supernatural red eyes, brooding werewolf king, dark coat, moonlit atmosphere, photorealistic.'
where not exists (select 1 from character_templates where name = 'Wolf King Caius');

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'Ancient General', '古装将军',
  array['armor', 'ancient', 'commanding', 'warrior']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=General',
  'Ancient Chinese general in layered armor and cloak, stern commanding presence, battlefield haze, cinematic epic shot.'
where not exists (select 1 from character_templates where name = 'Ancient General');

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'Sweet Girl Next Door', '甜美女主',
  array['natural', 'innocent', 'warm', 'approachable']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Sweet+Girl',
  'Warm approachable young woman, natural soft makeup, gentle smile, soft daylight, cozy modern setting, photorealistic.'
where not exists (select 1 from character_templates where name = 'Sweet Girl Next Door');

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'Dominant Mature Woman', '御姐女主',
  array['elegant', 'strong', 'mature', 'asian']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Dom+Mature',
  'Elegant mature woman, sharp features, monochrome chic outfit, confident gaze, high-end urban interior, photorealistic.'
where not exists (select 1 from character_templates where name = 'Dominant Mature Woman');

insert into character_templates (name, archetype, style_tags, reference_image_url, kling_prompt_base)
select 'Ethereal Ancient Fairy', '古装仙女',
  array['hanfu', 'ethereal', 'flowing', 'celestial']::text[],
  'https://placehold.co/400x600/0a0a0a/d4a574/png?text=Fairy',
  'Ethereal figure in flowing hanfu, celestial ribbons, soft glow, misty mountain backdrop, fantasy realism.'
where not exists (select 1 from character_templates where name = 'Ethereal Ancient Fairy');
