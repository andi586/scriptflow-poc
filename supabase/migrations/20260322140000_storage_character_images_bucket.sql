-- Public bucket for character template reference images (F63/F64 uploads)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-images',
  'character-images',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read objects (public bucket URLs)
create policy "character_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'character-images');

-- Uploads: browser uses anon key (see 20260322150000_storage_character_images_anon_upload.sql)
