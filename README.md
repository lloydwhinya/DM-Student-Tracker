# Digital Marketing Student Tracker (React + Supabase)

Real sign-up / sign-in, per-student access, role-specific dashboards, file uploads for photos and CVs.

## Setup
1. Create a free project at supabase.com.
2. SQL Editor: paste and run `supabase/schema.sql`.
3. SQL Editor: paste and run `supabase/cohort_community.sql` to enable the secure, read-only cohort community data.
4. Authentication > Providers: keep Email on. (Optional: turn off "Confirm email" while testing.)
5. Copy `.env.example` to `.env` and fill in your Project URL and anon key (Project Settings > API).
6. `npm install` then `npm run dev`.
7. Sign up in the app with your email, then run the `update profiles set role='admin' ...` line at the bottom of schema.sql.
8. Sign out and in again. You now see the admin dashboard; everyone else who signs up sees only their own profile and the limited cohort community view.

For an existing project, run `supabase/cohort_community.sql` in the Supabase SQL Editor; it adds the private-by-default sharing preference and the student-scoped community function.

## Dashboards and navigation
- Admins land on `/admin`, which summarizes student status, cohorts, employment, and upcoming interviews. Use `/admin/students` to search, filter, add, and edit student records.
- Students land on `/student` for their profile summary and completion prompt. Use `/student/profile` to create or update their own profile, or `/student/community` to see cohort statistics and opted-in peer portfolios.
- Routes are role-checked in the app, and Supabase row-level security continues to restrict student data access.

## Deploy
`npm run build`, then deploy the `dist/` output to Netlify, Vercel or Cloudflare Pages (add the two env vars there). SPA fallback rules are included so refreshing app routes such as `/student/profile` serves the app entry point.

## Notes
- Students see and edit only their own record. Admin notes are in a separate table students can never read.
- The student cohort community shows server-calculated cohort totals and only the name and portfolio link of peers who opted in and added a portfolio. Sharing is off by default; direct student table access remains restricted by row-level security.
- CVs are in a private bucket (opened through short-lived links). Photos are public.
- Students can currently edit their own status. Remove that field from the form for non-admins if you prefer.
