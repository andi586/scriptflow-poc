-- Permanent clip URLs after mirroring PiAPI/Kling output into Storage.
alter table public.kling_tasks
  add column if not exists output_url text;

-- Public bucket for scene MP4s (server uploads via service role; public read for playback/download).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scene-videos',
  'scene-videos',
  true,
  524288000,
  array['video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "scene_videos_public_read" on storage.objects;

create policy "scene_videos_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'scene-videos');
