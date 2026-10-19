-- Run once in Supabase SQL Editor for an existing project.
-- Replace this allowlisted email before running if a different account owns the app.
alter table public.profiles add column if not exists active boolean not null default false;

alter table public.profiles drop constraint if exists profiles_role_check;

update public.profiles p
set role = case
      when lower(u.email) = 'lloydwhinya98@gmail.com' and u.email_confirmed_at is not null then 'owner'
      when p.role = 'admin' then 'instructor'
      when p.role in ('student', 'instructor', 'owner', 'disabled') then p.role
      else 'disabled'
    end,
    active = case
      when lower(u.email) = 'lloydwhinya98@gmail.com' and u.email_confirmed_at is not null then true
      when p.role = 'admin' then true
      when p.role in ('student', 'owner', 'disabled') then false
      else p.active
    end
from auth.users u
where p.id = u.id;

insert into public.profiles (id, role, active)
select id, 'owner', true
from auth.users
where lower(email) = 'lloydwhinya98@gmail.com'
  and email_confirmed_at is not null
on conflict (id) do update set role = 'owner', active = true;

alter table public.profiles
  alter column role set default 'disabled',
  add constraint profiles_role_check check (role in ('student', 'instructor', 'owner', 'disabled'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'lloydwhinya98@gmail.com' and new.email_confirmed_at is not null then
    insert into public.profiles (id, role, active) values (new.id, 'owner', true);
  else
    insert into public.profiles (id, role, active) values (new.id, 'disabled', false);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.promote_allowlisted_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'lloydwhinya98@gmail.com' and new.email_confirmed_at is not null then
    insert into public.profiles (id, role, active) values (new.id, 'owner', true)
    on conflict (id) do update set role = 'owner', active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.promote_allowlisted_owner();

create or replace function public.is_instructor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role in ('owner', 'instructor')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role = 'owner'
  );
$$;

drop trigger if exists students_admin_controls_community_publish on public.students;
drop function if exists public.prevent_student_community_publish();
drop function if exists public.get_student_cohort_community();

drop policy if exists "own profile" on public.profiles;
drop policy if exists "read own profile or owner reads all" on public.profiles;
drop policy if exists "admin all students" on public.students;
drop policy if exists "student reads own" on public.students;
drop policy if exists "student creates own" on public.students;
drop policy if exists "student updates own" on public.students;
drop policy if exists "instructors read students" on public.students;
drop policy if exists "instructors add students" on public.students;
drop policy if exists "instructors update students" on public.students;
drop policy if exists "admin notes" on public.staff_notes;
drop policy if exists "instructors manage staff notes" on public.staff_notes;

create policy "read own profile or owner reads all"
on public.profiles for select
using ((id = auth.uid() and public.is_instructor()) or public.is_owner());

create policy "instructors read students"
on public.students for select
using (public.is_instructor());

create policy "instructors add students"
on public.students for insert
with check (public.is_instructor());

create policy "instructors update students"
on public.students for update
using (public.is_instructor())
with check (public.is_instructor());

create policy "instructors manage staff notes"
on public.staff_notes for all
using (public.is_instructor())
with check (public.is_instructor());

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false), ('cvs', 'cvs', false)
on conflict (id) do update set public = false;

drop policy if exists "photos public read" on storage.objects;
drop policy if exists "upload own or admin" on storage.objects;
drop policy if exists "instructors access student files" on storage.objects;

create policy "instructors access student files"
on storage.objects for all to authenticated
using (bucket_id in ('photos', 'cvs') and public.is_instructor())
with check (bucket_id in ('photos', 'cvs') and public.is_instructor());

revoke all on function public.is_instructor() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_instructor() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

-- Retain auth.users, profiles, student rows, and user_id links; block sign-in
-- for existing student accounts without deleting their identities or records.
update auth.users
set banned_until = 'infinity'::timestamptz
where id in (select id from public.profiles where role = 'student')
   or id in (
     select s.user_id
     from public.students s
     left join public.profiles p on p.id = s.user_id
     where s.user_id is not null
       and (p.id is null or not (p.active and p.role in ('owner', 'instructor')))
   );
