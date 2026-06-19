# Tech Stack

## Frontend

- **React 18** with JSX (`.jsx` files)
- **Vite 6** — dev server and build tool
- **No UI framework** — plain CSS in `frontend/src/styles.css`
- **No client-side router** — page state managed with a `page` string in `App.jsx`

## Backend / Database

- **Supabase** — auth, Postgres database, Row Level Security, and file storage
- **@supabase/supabase-js 2.x** — only the anon key is used in the browser; never expose the service role key client-side
- All database access goes through `frontend/src/api.js`; components never import `supabase` directly

## Auth

- Supabase Auth (email/password + Google OAuth)
- Session managed via `supabase.auth.onAuthStateChange` in `App.jsx`

## Deployment

- **Vercel** — SPA with `vercel.json` rewriting all routes to `index.html`
- Build command: `cd frontend && npm install && npm run build`
- Output: `frontend/dist`

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Copy `.env.example` to `.env.local` for local development. Never commit real keys.

## Common Commands

```bash
# Install dependencies
cd frontend && npm install

# Start dev server
cd frontend && npm run dev
# Runs at http://127.0.0.1:5173

# Production build
cd frontend && npm run build

# Preview production build locally
cd frontend && npm run preview
```

## Database Migrations

All SQL files are in `supabase/`. Run them manually in the Supabase SQL Editor in this order for a fresh setup:

1. `schema.sql`
2. `media-updates.sql`
3. `group-step-1a-tables-columns.sql`
4. `group-step-1b-functions.sql`
5. `group-step-2-backfill.sql`
6. `group-step-3a-access-policies.sql`
7. `group-step-3b-match-policies.sql`
8. `group-policy-tail-fix.sql`

There is no migration runner — SQL files are applied manually. When adding new schema changes, create a new `.sql` file in `supabase/` rather than editing existing ones.
