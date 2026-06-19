# Project Structure

```
fut5-organizer/
├── frontend/                  # Vite + React SPA
│   ├── src/
│   │   ├── App.jsx            # Root component: auth, state, routing, all async actions
│   │   ├── api.js             # All Supabase data access — single source of truth for DB calls
│   │   ├── supabaseClient.js  # Creates and exports the Supabase client + hasSupabaseConfig guard
│   │   ├── teamGeneration.js  # Balanced team algorithm (greedy + local swap)
│   │   ├── utils.js           # Pure helpers: formatting, labels, share text, clipboard
│   │   ├── constants.js       # Enums, label maps, empty form objects
│   │   ├── styles.css         # All CSS — no CSS modules, no Tailwind
│   │   ├── main.jsx           # React entry point
│   │   ├── components/        # Reusable, stateless UI pieces
│   │   │   ├── AttendanceAction.jsx
│   │   │   ├── Avatar.jsx
│   │   │   ├── CourtPhoto.jsx
│   │   │   ├── ExportCard.jsx
│   │   │   ├── MatchPhotoUpload.jsx
│   │   │   ├── StarRatingControl.jsx
│   │   │   ├── Stars.jsx
│   │   │   ├── Stat.jsx
│   │   │   └── TeamCards.jsx
│   │   └── pages/             # Full-page views rendered by App.jsx
│   │       ├── AdminPanel.jsx
│   │       ├── AuthScreen.jsx
│   │       ├── FeesPage.jsx
│   │       ├── FinesPage.jsx
│   │       ├── GroupsPage.jsx
│   │       ├── MatchDetail.jsx
│   │       ├── MatchesPage.jsx
│   │       ├── PlayersAdmin.jsx
│   │       ├── ProfileForm.jsx
│   │       ├── SuperAdminPage.jsx
│   │       ├── TeamPage.jsx
│   │       └── VenuesPage.jsx
│   ├── public/                # Static assets: PWA manifest, icons, service worker
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
├── supabase/                  # SQL migration files (applied manually)
│   ├── schema.sql             # Base schema + RLS policies
│   └── *.sql                  # Incremental migrations
├── vercel.json                # Vercel build config + SPA rewrite rule
└── .kiro/steering/            # AI assistant steering documents
```

## Architecture Patterns

### State Management
All application state lives in `App.jsx` as `useState` hooks. There is no global store (no Redux, Zustand, Context). Pages and components receive data and callbacks as props.

### Data Flow
`App.jsx` → `api.js` → Supabase. Components never call `api` or `supabase` directly. Every async action is an `async function` defined in `App.jsx` that updates state after the API call resolves.

### Routing
No router library. `App.jsx` holds a `page` string (`"matches"`, `"admin"`, `"profile"`, etc.) and conditionally renders the matching page component in `<main>`.

### API Layer (`api.js`)
- All Supabase queries use two helpers: `readOne(query)` and `readMany(query)` which unwrap `{ data, error }` and throw on errors.
- Methods are grouped by domain with section comments.
- `latestRatingsByProfile` is a pure function exported on the `api` object for convenience.

### Components vs Pages
- `components/` — small, reusable, receive only what they need via props, no direct data fetching.
- `pages/` — full-screen views, may be more complex but still receive all data/callbacks from `App.jsx`.

### Styling
Single flat CSS file (`styles.css`). Class names are composed with the `classNames(...values)` utility. CSS classes follow a simple BEM-like naming convention (e.g., `panel`, `section-heading`, `count-pill`, `match-row`, `bottom-nav-item`).

### Permissions
Role checks happen in `App.jsx` (`isAdmin`, `isSuperAdmin`, `isActiveMember`) and are passed as boolean props. Pages and components never re-derive roles from raw data.

### Localization
UI strings are in Spanish. Dates use `Intl.DateTimeFormat("es-GT")`. Currency uses `Intl.NumberFormat` with `currency: "GTQ"`. Do not introduce an i18n library — keep strings inline.
