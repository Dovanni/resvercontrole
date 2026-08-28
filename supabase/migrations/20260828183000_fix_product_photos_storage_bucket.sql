insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read product-photos" on storage.objects;
drop policy if exists "users read own product-photos" on storage.objects;
drop policy if exists "users upload own product-photos" on storage.objects;
drop policy if exists "users update own product-photos" on storage.objects;
drop policy if exists "users delete own product-photos" on storage.objects;

create policy "users read own product-photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users upload own product-photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users update own product-photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'product-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users delete own product-photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);
