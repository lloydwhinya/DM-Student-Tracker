-- Run this policy update in Supabase SQL Editor; do not rerun schema.sql.
drop policy if exists "upload own or admin" on storage.objects;
create policy "upload own or admin" on storage.objects
for all to authenticated
using (
  bucket_id in ('photos', 'cvs')
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.students s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  )
)
with check (
  bucket_id in ('photos', 'cvs')
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.students s
      where s.id::text = (storage.foldername(name))[1]
        and s.user_id = auth.uid()
    )
  )
);