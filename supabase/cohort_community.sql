-- Student cohort community access has been retired.
-- Run instructor_private_migration.sql to apply the private instructor policies.
drop function if exists public.get_student_cohort_community();

drop trigger if exists students_admin_controls_community_publish on public.students;
drop function if exists public.prevent_student_community_publish();
