# Aloft — a floating, branching to-do list

Node.js/Express backend + React/Tailwind frontend powered by **Supabase Authentication & PostgreSQL Database** with Row Level Security (RLS).

## Features
- **Authentication** — Sign in and sign up with email and password or **Google Account directly** via Supabase OAuth.
- **Per-User Isolation** — Every task, tree node, habit, and theme setting is strictly scoped to the authenticated user via Postgres Row Level Security (RLS).
- **Queue** — one-day tasks. Square blocks levitate gently and float in, left to right, as you add them. Each has a checkbox and optional deadline.
- **Unlimited Tree View** — long-term goals structured with unlimited nested sub-groups and tasks to arbitrary depth. Checking a group instantly cascades to every descendant, and a parent auto-checks once all its children are checked.
- **365-Day Habits Tracker** — daily habit tracker across the full year with a 53-week GitHub-style contribution heat grid, collapsible month cards, streaks, completion metrics, and automatic year rollover.
- **Calendar** — a month view pulling every deadline from both the Queue and the Tree.
- **Settings** — switch the whole app's color theme per-user, including:
  - **Cotton Candy** (the default): `#ffcbcb #ffa7a7 #c9fdff #dffeff #fff4f4`
  - **Black & White** — a strictly monochrome, no-neon palette
  - 5 custom palettes: Sunset Ember, Royal Violet, Electric Sky, Mauve Berry, Tropical Pop

## Project structure
```
aloft-todo-app/
  api/                Vercel Serverless Function entry point (api/index.js)
  backend/            Express API with Sup
  vercel.json         Vercel deployment configuration
```

## Supabase Setup & Database Migration

1. **Create a Supabase Project**:
   - Go to [database.new](https://database.new) and create a new project.
   - Note down your **Project URL**, **anon/public key**, and **service_role key** from *Project Settings > API*.

2. **Run Migrations**:
   - **Option A (Supabase Dashboard)**: Open the **SQL Editor** in your Supabase project dashboard, copy the contents of `supabase/schema.sql`, and click **Run**.
   - **Option B (Supabase CLI)**: Run `supabase db push` or apply the SQL files in `supabase/migrations/`.

3. **Configure Google OAuth (Optional for Direct Google Sign-In)**:
   - Create OAuth 2.0 Credentials (Client ID & Secret) in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   - In Google Cloud Console, set the Authorized Redirect URI to: `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`.
   - In Supabase Dashboard: Go to *Authentication > Providers > Google*, enable it, and enter your Client ID and Client Secret.
   - U