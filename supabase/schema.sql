-- Fresh-project schema for a private, instructor-managed student database.
-- Keep the owner email in handle_new_user() and promote_allowlisted_owner()
-- aligned with the account that should own this Supabase project.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'disabled' check (role in ('student', 'instructor', 'owner', 'disabled')),
  active boolean not null default false
);

create function public.handle_new_user()
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.promote_allowlisted_owner()
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

create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.promote_allowlisted_owner();

create function public.is_instructor()
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

create function public.is_owner()
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

revoke all on function public.is_instructor() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_instructor() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users on delete set null,
  name text not null,
  cohort text,
  email text,
  phone text,
  status text default 'Enrolled',
  goal text,
  skills text[] default '{}',
  tools text,
  certs text,
  portfolio text,
  community_published boolean not null default false,
  linkedin text,
  photo_path text,
  cv_path text,
  employer text,
  job_title text,
  start_date date,
  clients text,
  interviews jsonb default '[]',
  created_at timestamptz default now()
);

create table public.staff_notes (
  student_id uuid primary key references public.students on delete cascade,
  notes text
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.staff_notes enable row level security;

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

create policy "instructors access student files"
on storage.objects for all to authenticated
using (bucket_id in ('photos', 'cvs') and public.is_instructor())
with check (bucket_id in ('photos', 'cvs') and public.is_instructor());

-- Existing student rows and auth.users are retained. The auth account link remains
-- available to instructors, but student roles have no student-table or file policies.
