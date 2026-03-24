-- Loosen browser upload RLS for character-images so cast pick-time uploads won't fail.
drop policy if exists "character_images_anon_authenticated_insert" on storage.objects;
drop policy if exists "character_images_anon_authenticated_update" on storage.objects;

create policy "character_images_anon_authenticated_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'character-images');

create policy "character_images_anon_authenticated_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'character-images')
  with check (bucket_id = 'character-images');
