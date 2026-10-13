-- Run in Supabase SQL Editor. Keep email confirmation enabled in Supabase Auth.
create or replace function public.promote_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'lloydwhinya98@gmail.com'
     and new.email_confirmed_at is not null then
    insert into public.profiles (id, role)
    values (new.id, 'admin')
    on conflict (id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.promote_allowlisted_admin();

update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'lloydwhinya98@gmail.com'
  and u.email_confirmed_at is not null;