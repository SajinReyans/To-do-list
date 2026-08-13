# Aloft — a floating, branching to-do list

Node.js/Express backend + React/Tailwind frontend.

## Features
- **Queue** — one-day tasks. Square blocks levitate gently and float in, left to right, as you add them. Each has a checkbox and optional deadline.
- **Tree** — long-term to-do lists structured as groups → tasks (e.g. "Programming languages" → "HTML", "CSS"). Checking a group instantly checks every task beneath it, and a group auto-checks once all its children are checked.
- **Calendar** — a month view pulling every deadline from both the Queue and the Tree.
- **Settings** — switch the whole app's color theme, including:
  - **Cotton Candy** (the default): `#ffcbcb #ffa7a7 #c9fdff #dffeff #fff4f4`
  - **Black & White** — a strictly monochrome, no-neon palette
  - 5 custom palettes: Sunset Ember, Royal Violet, Electric Sky, Mauve Berry, Tropical Pop

## Project structure
```
todo-app/
  backend/    Express API, JSON file storage (backend/data/db.json)
  frontend/   React + Vite + Tailwind CSS
```

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

Open http://localhost:5173 — the frontend talks to the backend at `localhost:4000` (see `frontend/src/api.js` if you need to change the URL, e.g. for deployment).

## API overview
- `GET/POST /api/queue`, `PATCH/DELETE /api/queue/:id`
- `GET/POST /api/tree`, `PATCH/DELETE /api/tree/:id` (PATCH with `checked` cascades to all descendants and bubbles the checked state up to parents)
- `GET/PATCH /api/settings` (`{ theme: "cottonCandy" | "monochrome" | "sunsetEmber" | "royalViolet" | "electricSky" | "mauveBerry" | "tropicalPop" }`)

Data persists to `backend/data/db.json` — no external database needed. Swap `store.js` for a real database later without touching the routes' logic.
