-- Run this in Supabase SQL Editor after schema.sql.
-- Safe to run on existing projects; profiles remain private under the existing RLS policies.
alter table public.students
  add column if not exists cohort_visible boolean not null default false;

create or replace function public.get_student_cohort_community()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_cohort text;
  v_has_cohort boolean := false;
  v_total_students bigint := 0;
  v_enrolled_students bigint := 0;
  v_employed_students bigint := 0;
  v_peers jsonb := '[]'::jsonb;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'student'
     ) then
    raise exception 'Student access required';
  end if;

  select cohort into v_cohort
  from public.students
  where user_id = auth.uid();

  v_has_cohort := found and nullif(btrim(v_cohort), '') is not null;

  if v_has_cohort then
    select count(*),
           count(*) filter (where status = 'Enrolled'),
           count(*) filter (where status = 'Employed')
    into v_total_students, v_enrolled_students, v_employed_students
    from public.students
    where cohort = v_cohort;

    select coalesce(
      jsonb_agg(jsonb_build_object('name', name, 'portfolio', portfolio) order by name),
      '[]'::jsonb
    )
    into v_peers
    from public.students
    where cohort = v_cohort
      and user_id <> auth.uid()
      and cohort_visible
      and nullif(btrim(portfolio), '') is not null;
  end if;

  return jsonb_build_object(
    'has_cohort', v_has_cohort,
    'total_students', v_total_students,
    'enrolled_students', v_enrolled_students,
    'employed_students', v_employed_students,
    'peers', v_peers
  );
end;
$$;

revoke all on function public.get_student_cohort_community() from public;
revoke all on function public.get_student_cohort_community() from anon;
grant execute on function public.get_student_cohort_community() to authenticated;
