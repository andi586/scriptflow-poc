-- Protected template names: Wolf King Caius / Sweet Girl Next Door / Marcus (never delete/clear URLs).
-- Browser-direct uploads to character-images (anon + authenticated), path must start with a UUID folder (template id)

drop policy if exists "character_images_anon_authenticated_insert" on storage.objects;
drop policy if exists "character_images_anon_authenticated_update" on storage.objects;

create policy "character_images_anon_authenticated_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'character-images'
    and split_part(name, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

create policy "character_images_anon_authenticated_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'character-images')
  with check (
    bucket_id = 'character-images'
    and split_part(name, '/', 1)
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );
