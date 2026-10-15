-- Run this once in Supabase: SQL Editor > New query > paste > Run
create table profiles (id uuid primary key references auth.users on delete cascade, role text not null default 'student' check (role in ('student','admin')));
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.promote_allowlisted_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if lower(new.email)='lloydwhinya98@gmail.com' and new.email_confirmed_at is not null then
  insert into public.profiles(id, role) values (new.id, 'admin')
  on conflict (id) do update set role='admin';
 end if;
 return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
 for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
 execute function public.promote_allowlisted_admin();
create function public.is_admin() returns boolean language sql security definer set search_path=public stable as $$
 select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;

create table students (
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references auth.users on delete set null,
 name text not null, cohort text, email text, phone text,
 status text default 'Enrolled', goal text,
 skills text[] default '{}', tools text, certs text,
 portfolio text, cohort_visible boolean not null default false,
 linkedin text, photo_path text, cv_path text,
 employer text, job_title text, start_date date, clients text,
 interviews jsonb default '[]', created_at timestamptz default now());
create table staff_notes (student_id uuid primary key references students on delete cascade, notes text);

alter table profiles enable row level security;
alter table students enable row level security;
alter table staff_notes enable row level security;
create policy "own profile" on profiles for select using (id=auth.uid() or is_admin());
create policy "admin all students" on students for all using (is_admin()) with check (is_admin());
create policy "student reads own" on students for select using (user_id=auth.uid());
create policy "student creates own" on students for insert with check (user_id=auth.uid());
create policy "student updates own" on students for update using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "admin notes" on staff_notes for all using (is_admin()) with check (is_admin());

-- Files: photos (public) and cvs (private). Files live in a folder named after the student row id.
insert into storage.buckets (id,name,public) values ('photos','photos',true),('cvs','cvs',false);
create policy "photos public read" on storage.objects for select using (bucket_id='photos');
drop policy if exists "upload own or admin" on storage.objects;
create policy "upload own or admin" on storage.objects for all to authenticated
 using (bucket_id in ('photos','cvs') and (is_admin() or (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from students s where s.id::text=(storage.foldername(name))[1] and s.user_id=auth.uid())))
 with check (bucket_id in ('photos','cvs') and (is_admin() or (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from students s where s.id::text=(storage.foldername(name))[1] and s.user_id=auth.uid())));

-- After you sign up with your own email, make yourself admin:
-- update profiles set role='admin' where id=(select id from auth.users where email='YOU@EXAMPLE.COM');
