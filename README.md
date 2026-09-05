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
  backend/            Express API with Supabase Auth verification & DB queries
  frontend/           React + Vite + Tailwind CSS with Supabase AuthContext & AuthScreen
  supabase/           Database schema and migrations
    schema.sql        Full database schema, indexes, and RLS policies
    migrations/       Timestamped migrations for Supabase CLI
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
   - Under *Authentication > URL Configuration > Redirect URLs*, add `http://localhost:5173` (and your production domain).

4. **Configure Environment Variables**:

   In `backend/.env`:
   ```bash
   PORT=4000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   In `frontend/.env`:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## Year Rollover Mechanism
Habits are defined per-year (`year` column in `habits` table) to maintain distinct annual progress records:
- When a user views the current year in the Habits Tracker, the backend automatically checks if active habits exist from the previous year.
- If previous active habits exist and the current year has no habits yet, they are automatically carried over on-the-fly to the current year with empty completion grids.
- Historical years remain intact and can be explored at any time via the Year Selector.

## Run it

**Backend** (http://localhost:4000):
```bash
cd backend
npm install
npm start
```

**Frontend** (http://localhost:5173):
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — sign in with email or click **Continue with Google** to start using Aloft!

## Render Deployment

For a complete step-by-step walkthrough, see [`RENDER_DEPLOYMENT.md`](RENDER_DEPLOYMENT.md).

You can deploy Aloft to [Render](https://render.com) easily using the included Blueprint (`render.yaml`) or as a standard Web Service.

### Option A: Render Blueprint (Recommended)
1. In [Render Dashboard](https://dashboard.render.com), click **New +** > **Blueprint**.
2. Connect your GitHub repository. Render will automatically detect [`render.yaml`](file:///home/sajinreyans/project/To-do-list/render.yaml).
3. Fill in the required environment variables:
   - `SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your Supabase Anon/Public API Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role API Key
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon/Public API Key
4. Click **Apply**.

### Option B: Manual Web Service Setup on Render
1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your repository.
3. Configure settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build` (or `npm run render-build`)
   - **Start Command**: `npm start`
4. Add the environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5. Click **Deploy Web Service**.

## Vercel Deployment

Deploy this entire application (Frontend + Serverless Express Backend) to Vercel in a single project:

1. Push this repository to GitHub / GitLab / Bitbucket.
2. In [Vercel Dashboard](https://vercel.com/new), click **Add New Project** and import this repository.
3. Keep the default settings:
   - **Framework Preset**: Vite (or Other)
   - **Root Directory**: `./` (leave as project root)
   - **Build Command**: `npm run build --prefix frontend` (automatically configured by `vercel.json`)
   - **Output Directory**: `frontend/dist` (automatically configured by `vercel.json`)
4. Add the following **Environment Variables** in Vercel (*Project Settings > Environment Variables*):
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon/Public API Key
