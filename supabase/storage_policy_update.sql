-- Run after instructor_private_migration.sql on an existing project.
update storage.buckets set public = false where id in ('photos', 'cvs');

drop policy if exists "photos public read" on storage.objects;
drop policy if exists "upload own or admin" on storage.objects;
drop policy if exists "instructors access student files" on storage.objects;

create policy "instructors access student files"
on storage.objects for all to authenticated
using (bucket_id in ('photos', 'cvs') and public.is_instructor())
with check (bucket_id in ('photos', 'cvs') and public.is_instructor());
