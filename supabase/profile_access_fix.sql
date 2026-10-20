-- Repair profile access metadata in an existing Supabase project.
-- Confirm this is the correct owner email before running.
begin;

alter table public.profiles
  add column if not exists active boolean not null default false;

update public.profiles
set active = false
where active is null;

alter table public.profiles
  alter column active set default false,
  alter column active set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles p
set role = case
      when lower(u.email) = 'lloydwhinya98@gmail.com'
        and u.email_confirmed_at is not null then 'owner'
      when p.role = 'admin' then 'instructor'
      when p.role in ('student', 'instructor', 'owner', 'disabled') then p.role
      else 'disabled'
    end,
    active = case
      when lower(u.email) = 'lloydwhinya98@gmail.com'
        and u.email_confirmed_at is not null then true
      when p.role = 'admin' then true
      when p.role in ('student', 'owner', 'disabled') then false
      else coalesce(p.active, false)
    end
from auth.users u
where p.id = u.id;

insert into public.profiles (id, role, active)
select id, 'owner', true
from auth.users
where lower(email) = 'lloydwhinya98@gmail.com'
  and email_confirmed_at is not null
on conflict (id) do update
set role = 'owner', active = true;

alter table public.profiles
  alter column role set default 'disabled',
  alter column role set not null,
  add constraint profiles_role_check
    check (role in ('student', 'instructor', 'owner', 'disabled'));

notify pgrst, 'reload schema';

commit;
