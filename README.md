# Instructor Student Database (React + Supabase)

A private database for instructors to manage student records, cohorts, outcomes, portfolios, interviews, CVs, and instructor notes. Students cannot register for or access the application.

## Setup

1. Create a Supabase project.
2. For a new project, set the owner email in `supabase/schema.sql`, then run that file in Supabase SQL Editor.
3. In Supabase Authentication settings, disable public sign-ups, keep email confirmation enabled, configure email delivery, and set the production Site URL to `https://your-app.example.com/instructor/sign-in?invite=1`. Add the matching production URLs `/instructor/sign-in?invite=1` and `/instructor/sign-in?recovery=1` to the allowed redirect URLs.
4. Invite the owner account from Supabase Dashboard > Authentication > Users. The database trigger assigns owner access only to the configured owner email; the invite link opens the app's password-setup screen.
5. Deploy the `manage-instructors` Edge Function:
   ```sh
   supabase functions deploy manage-instructors
   supabase secrets set SITE_URL=https://your-app.example.com
   ```
   Supabase supplies the project URL, anon key, and service-role key to the function environment. Never put the service-role key in a `VITE_` variable or the browser.
6. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the project.
7. Run `npm install` and `npm run dev`.

### Existing project migration

Back up the database first, then run `supabase/instructor_private_migration.sql` once in Supabase SQL Editor. The existing allowlisted owner email is `lloydwhinya98@gmail.com`; change its occurrences in the migration before running it if ownership should belong to a different account. The migration converts existing admin profiles to owner/instructor roles, bans existing student auth accounts, removes student table/storage policies and community access, and makes photos private. It does not delete student rows, auth users, profiles, or their `students.user_id` links.

Deploy the Edge Function and set `SITE_URL` as above after applying the database migration. The `supabase/cohort_community.sql` file now only removes the retired student community RPC. Do not run the legacy signup or community setup instructions from an earlier app version.

## Routes and access

- `/instructor/sign-in` is the only public app route. All other signed-out routes redirect there.
- `/dashboard` is the instructor overview.
- `/students` provides student search, status/cohort filters, grouping, add, view, and edit.
- `/instructors` is available only to the owner. Old `/admin` routes redirect to the instructor dashboard/student list. Old `/student/*` routes no longer render student pages.

The owner invites instructors from **Manage instructors** by email. Supabase Auth sends the invitation; its link opens the app's password-setup screen, where the invitee sets their own password. Password-reset emails also return to an in-app password update screen. The owner can deactivate or restore instructor access on the same page. Existing student accounts and other existing accounts cannot be promoted through this flow. Instructors can manage student data and notes but cannot invite instructors, change roles, or manage the owner account.

## Data and authorization

Supabase row-level security permits student-record and instructor-note access only to active `owner` and `instructor` profiles. Profile roles are not client-editable. The private Edge Function verifies the caller's owner role before using the service-role key for invites and access changes. Student records have no delete policy. Existing auth accounts for students are banned rather than deleted, and their profile/student links remain for instructors. The former community publication column is retained but unused.

Student photos and CVs are in private storage buckets and are opened with short-lived signed URLs. Previously public photo URLs may have been cached or copied outside Supabase; making the bucket private cannot retract those external copies.

## Deploy

Run `npm run build`, then deploy the `dist/` output to Netlify, Vercel, or Cloudflare Pages. Add the two `VITE_` Supabase environment variables to the hosting project and keep its SPA fallback/rewrite enabled. Set the Edge Function `SITE_URL` secret to the deployed origin and include that URL in Supabase Auth's allowed redirect URLs.
