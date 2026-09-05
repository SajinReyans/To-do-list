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
