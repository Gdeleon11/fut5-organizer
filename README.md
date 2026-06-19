# fut5-organizer

Self-signup, mobile-first 5-a-side football organizer for private groups.

Players sign up, complete their own profile, and confirm attendance from their
phones. Each organizer can create a separate chamusca, become admin of that
group, invite players, activate/deactivate them, assign ratings, generate
balanced teams, and manage fines without mixing data with other groups.

Production URL:

```text
https://fut5-organizer.vercel.app
```

## What Changed

1. Supabase is now the backend, database, and auth provider.
2. The old manual admin "Add player" flow has been removed.
3. Players authenticate with Supabase email/password auth.
4. First login creates a `profiles` row automatically.
5. Incomplete profiles are sent to a one-time profile completion screen.
6. Player star levels are stored separately in `player_ratings` and are admin-only.
7. Attendance, teams, and fines now reference authenticated `profiles`.
8. Supabase Row Level Security protects player/admin permissions.
9. The frontend is prepared for Vercel deployment.
10. Multiple groups are supported through `groups` and `group_members`; admin
    access is now per group.

## Stack

- React + Vite
- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Vercel hosting
- PWA-ready mobile UI

## Project Structure

```text
fut5-organizer/
  frontend/
    src/
      App.jsx
      api.js
      main.jsx
      styles.css
      supabaseClient.js
      teamGeneration.js
    .env.example
    index.html
    package.json
    vite.config.js
  supabase/
    schema.sql
    media-updates.sql
    groups-migration.sql
  vercel.json
```

## Step 1 - Supabase Integration

The app uses `@supabase/supabase-js` in
`frontend/src/supabaseClient.js`.

Required frontend variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Only the anon key is used in the browser. Do not put the service role key in
Vite, Vercel frontend variables, or any client-side file.

## Step 2 - Authentication

The app supports Google OAuth and email/password auth through Supabase. Google
is recommended for invited players because it avoids Supabase email rate limits
on signup/confirmation messages.

Implemented:

- Login
- Signup
- Google sign-in
- Sign out
- Persisted Supabase session
- Authenticated app shell
- Admin-only navigation based on the active `group_members.role`
- RLS-backed admin permissions in the database

## Step 3 - Database Schema

Run the base schema first:

```text
supabase/schema.sql
```

Then run:

```text
supabase/media-updates.sql
supabase/groups-migration.sql
```

Together they create:

- `profiles`
- `groups`
- `group_members`
- `player_ratings`
- `matches`
- `attendances`
- `teams`
- `team_members`
- `fines`
- `settings`

It also creates triggers for:

- `updated_at`
- automatic profile creation after Supabase Auth signup
- preventing non-admin users from changing protected profile fields

## Step 4 - Automatic Profile Onboarding

After signup/login:

1. The database trigger creates a `profiles` row for the auth user.
2. The frontend also calls `api.ensureProfile()` as a safe fallback.
3. If required fields are missing, the user sees the profile completion screen.
4. Players can update:
   - `full_name`
   - `nickname`
   - `phone`
   - `preferred_position`

Players cannot update:

- group role
- group active status
- ratings

## Step 5 - Groups, Roles and Permissions

Every chamusca is a `groups` row. A user belongs to a group through
`group_members`.

- Player: `group_members.role = 'player'`
- Admin: `group_members.role = 'admin'`
- Active/pending status: `group_members.is_active`

RLS rules enforce:

- Players can read/update their own basic profile.
- Players can view data only for groups where they are members.
- Players cannot change their own group role, active status, or rating.
- Players can view matches for their groups.
- Players can confirm attendance only when active in that group.
- Players can see only their own fines.
- Group admins can view that group's registered players.
- Group admins can activate/deactivate players in that group.
- Group admins can assign 1-4 star levels for that group.
- Group admins can create matches, generate teams, upload court photos, and
  manage fines for that group.

The RLS policies are all in `supabase/schema.sql`.

## Step 6 - Admin Panel

The old "Add player" form is gone.

Admins now manage registered players:

- Registered users list
- Active/inactive toggle
- Star picker from 1 to 4
- Preferred position override
- Players upload their own avatar from Profile
- Attendance history summary
- Fines summary

Filters:

- all
- active
- inactive
- unrated
- unpaid

## Step 7 - Player Experience

Mobile player flow:

1. Open the app link.
2. Sign up or log in.
3. Complete profile once.
4. View upcoming matches.
5. Confirm attendance with one tap.
6. View assigned teams.
7. View fines and debt balance.

Screens:

- Login/signup
- Complete profile
- Upcoming matches
- Match detail
- Team assignment
- Fines
- Profile

## Step 8 - Attendance and Teams

Attendance now uses `attendances.profile_id`.

Rules:

- Only active players can confirm.
- Team generation requires 10 to 18 confirmed active players.
- 10 to 14 players creates 2 teams.
- 15 to 18 players creates 3 teams.
- Latest star level from `player_ratings` is used.
- Unrated players default to 2 stars for generation.
- Goalkeepers are spread where possible.
- The algorithm does greedy assignment, then local swaps.

Team generation code:

```text
frontend/src/teamGeneration.js
```

## Step 9 - Fines

Fines now use `fines.profile_id`.

Rules:

- Admin can mark a confirmed player as no-show.
- Marking no-show creates an open fine.
- Admin can mark fines as paid.
- Admin can forgive fines.
- Players can see only their own fines.
- Admins can see all fines.

## Step 10 - Mobile UI and PWA

The app keeps the existing mobile-first styling:

- Bottom navigation for logged-in users
- Large tap targets
- Clear active/inactive/confirmed/no-show/paid states
- Profile avatar uploads through Supabase Storage
- Court photos for matches through Supabase Storage
- PWA manifest and service worker
- WhatsApp copy/share text for match invites and team announcements

## Step 11 - Supabase Setup

1. Create a Supabase project.
2. Open Authentication > Providers.
3. Enable Email auth.
4. Enable Google auth for the easiest invitation flow.
5. Open SQL Editor.
6. Paste and run `supabase/schema.sql`.
7. Paste and run `supabase/media-updates.sql`.
8. Paste and run the multi-group SQL files in this order:
   - `supabase/group-step-1a-tables-columns.sql`
   - `supabase/group-step-1b-functions.sql`
   - `supabase/group-step-2-backfill.sql`
   - `supabase/group-step-3a-access-policies.sql`
   - `supabase/group-step-3b-match-policies.sql`
   - `supabase/group-policy-tail-fix.sql`
9. Sign up through the app, complete your profile, then create your first group
   from the Grupos tab. You automatically become admin of groups you create.

### Google Auth Setup

In Supabase:

1. Go to Authentication > Providers > Google.
2. Enable Google.
3. Copy Supabase's Google callback URL from that screen.
4. In Google Cloud Console, create an OAuth Web Client and add that Supabase
   callback URL as an authorized redirect URI.
5. Paste the Google OAuth Client ID and Client Secret back into Supabase.
6. In Supabase Authentication > URL Configuration, add redirect URLs:

```text
https://fut5-organizer.vercel.app/**
http://127.0.0.1:5173/**
```

If you use another Vercel domain, add that domain too. The app redirects users
back to the same invitation link, including `?group=...` and `?match=...`.

For an existing single-group project, the multi-group step files create a default
`Mi chamusca` group, move existing matches/ratings/fines/settings into it, and
convert current admins into admins of that group.

If you still need to repair an old global admin account before running the group
migration, you can promote that user by email:

```sql
update public.profiles
set is_admin = true
where id = (
  select id
  from auth.users
  where lower(email) = lower('you@example.com')
)
returning id, full_name, nickname, is_admin;
```

The `returning` result should show one row with `is_admin = true`. After the
group migration, admin controls come from `group_members.role`.

If you are updating an existing project that was created before media uploads,
run this before the group migration:

```text
supabase/media-updates.sql
```

That migration adds `profiles.avatar_url` and `matches.court_photo_url`, creates
the public `avatars` and `match-photos` Storage buckets, and applies the needed
Storage policies. It also converts old 1-10 ratings to the current 1-4 star
scale. The older `supabase/fix-admin-avatar.sql` is still available if you also
need to repair the first-admin trigger.

## Step 12 - Vercel Deployment

1. Import the repository in Vercel.
2. Keep the included `vercel.json`.
3. Add environment variables:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Deploy.
5. In Supabase Authentication > URL Configuration:
   - Set Site URL to your Vercel URL.
   - Add your Vercel URL to Redirect URLs.

## Local Development

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Production build:

```bash
cd frontend
npm run build
```

## Security Notes

- RLS is enabled on every app table.
- The frontend uses only the Supabase anon key.
- Group admin privileges come from `group_members.role`.
- Group data is scoped by `group_id`.
- Non-admin users cannot update protected profile or membership fields.
- Star level writes are group-admin-only.
- Fine writes are group-admin-only.
- Match creation and team generation writes are group-admin-only.

## Important Files

- Refactored app: `frontend/src/App.jsx`
- Supabase data layer: `frontend/src/api.js`
- Supabase client: `frontend/src/supabaseClient.js`
- Team generation: `frontend/src/teamGeneration.js`
- SQL schema and RLS: `supabase/schema.sql`
- Existing-project media migration: `supabase/media-updates.sql`
- Multi-group migration: `supabase/groups-migration.sql`
- Existing-project admin/avatar fix: `supabase/fix-admin-avatar.sql`
- Env template: `frontend/.env.example`
- Vercel config: `vercel.json`
