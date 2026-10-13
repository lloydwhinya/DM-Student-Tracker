# Digital Marketing Student Tracker (React + Supabase)

Real sign-up / sign-in, per-student access, role-specific dashboards, file uploads for photos and CVs.

## Setup
1. Create a free project at supabase.com.
2. SQL Editor: paste and run `supabase/schema.sql`.
3. Authentication > Providers: keep Email on. (Optional: turn off "Confirm email" while testing.)
4. Copy `.env.example` to `.env` and fill in your Project URL and anon key (Project Settings > API).
5. `npm install` then `npm run dev`.
6. Sign up in the app with your email, then run the `update profiles set role='admin' ...` line at the bottom of schema.sql.
7. Sign out and in again. You now see the admin dashboard; everyone else who signs up sees only their own profile.

## Dashboards and navigation
- Admins land on `/admin`, which summarizes student status, cohorts, employment, and upcoming interviews. Use `/admin/students` to search, filter, add, and edit student records.
- Students land on `/student` for their profile summary and completion prompt. Use `/student/profile` to create or update their own profile; saving returns to the dashboard.
- Routes are role-checked in the app, and Supabase row-level security continues to restrict student data access.

## Deploy
`npm run build`, then upload `dist/` to Netlify, Vercel or Cloudflare Pages (add the two env vars there).

## Notes
- Students see and edit only their own record. Admin notes are in a separate table students can never read.
- CVs are in a private bucket (opened through short-lived links). Photos are public.
- Students can currently edit their own status. Remove that field from the form for non-admins if you prefer.
