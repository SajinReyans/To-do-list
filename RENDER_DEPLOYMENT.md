# Deploying Aloft to Render.com

This guide explains how to deploy the Aloft To-Do Application (Node.js/Express backend + React/Vite frontend + Supabase database & auth) on **[Render.com](https://render.com)**.

> [!NOTE]
> No sensitive credentials (passwords, live tokens, or secret keys) are committed to this repository. All sensitive credentials are provided securely via Render environment variables. `SUPABASE_SERVICE_ROLE_KEY` is strictly isolated to the backend service.

---

## Architecture on Render

The application can be deployed cleanly as two specialized services via [`render.yaml`](render.yaml):

1. **`aloft-backend` (Web Service)**:
   - Node.js & Express API listening on `0.0.0.0` with `process.env.PORT`.
   - Connects to Supabase with PostgreSQL Row Level Security (RLS).
   - Holds `SUPABASE_SERVICE_ROLE_KEY` securely on the server.
   - Dynamic CORS enabled for all `*.onrender.com` domains and configurable `CORS_ORIGIN`.

2. **`aloft-frontend` (Static Site)**:
   - React + Vite + Tailwind SPA hosted on Render's global CDN (100% free).
   - Communicates with backend via `VITE_API_URL`.
   - Only uses public anon keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
   - Client-side routing with automatic SPA rewrite rules (`/*` → `/index.html`).

---

## 1. Prerequisites

1. A **[Render.com](https://render.com)** account.
2. A **[Supabase](https://supabase.com)** account and project.
3. Your code pushed to a Git repository (GitHub or GitLab).

---

## 2. Prepare Supabase Database (One-time Setup)

1. Open your Supabase Dashboard: [database.new](https://database.new)
2. Run database migrations:
   - Navigate to **SQL Editor** in your Supabase project.
   - Open [`supabase/schema.sql`](supabase/schema.sql), copy its contents, paste them into the SQL Editor, and click **Run**.
3. Retrieve your API credentials from **Project Settings > API**:
   - **Project URL** (e.g. `https://your-project-id.supabase.co`)
   - **anon / public key**
   - **service_role key** (keep confidential, backend only!)

---

## 3. Deploy to Render via Blueprint (Recommended)

The repository provides a pre-configured [`render.yaml`](render.yaml) Blueprint that creates both services together.

1. In your **Render Dashboard**, click **New +** (top right) and choose **Blueprint**.
2. Connect your Git repository.
3. Render reads `render.yaml` and detects two services: `aloft-backend` and `aloft-frontend`.
4. Fill in the environment variables:

### Backend Service (`aloft-backend`):
| Key | Example Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `10000` | Port for Express on 0.0.0.0 |
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `your-supabase-anon-key` | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-supabase-service-role-key` | Supabase secret key (server only) |
| `CORS_ORIGIN` | `https://aloft-frontend.onrender.com` | (Optional) Explicit frontend URL |

### Frontend Service (`aloft-frontend`):
| Key | Example Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://aloft-backend.onrender.com` | URL of your deployed backend service |
| `VITE_SUPABASE_URL` | `https://your-project-id.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `your-supabase-anon-key` | Supabase public anon key |

5. Click **Apply**. Render will trigger the builds and deploy both services.

> [!TIP]
> If you deploy for the first time, your backend URL will be `https://aloft-backend.onrender.com` (or similar depending on your service name). Make sure `VITE_API_URL` in the frontend service points to this backend URL.

---

## 4. Manual Deployment Option

If you prefer creating services manually in the Render dashboard:

### Step 4A: Create Backend Web Service
1. **New +** > **Web Service** > Connect Git repository.
2. Settings:
   - **Name**: `aloft-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install --prefix backend`
   - **Start Command**: `npm run start --prefix backend`
   - **Instance Type**: `Free`
3. Add Backend Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `SUPABASE_URL`: `https://your-project-id.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `CORS_ORIGIN`: `https://aloft-frontend.onrender.com`
4. Deploy and copy your backend URL (`https://aloft-backend.onrender.com`).

### Step 4B: Create Frontend Static Site
1. **New +** > **Static Site** > Connect Git repository.
2. Settings:
   - **Name**: `aloft-frontend`
   - **Build Command**: `npm install --prefix frontend && npm run build --prefix frontend`
   - **Publish Directory**: `./frontend/dist`
3. Under **Redirects/Rewrites**, add:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
4. Add Frontend Environment Variables:
   - `VITE_API_URL`: `https://aloft-backend.onrender.com`
   - `VITE_SUPABASE_URL`: `https://your-project-id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
5. Deploy and copy your frontend URL (`https://aloft-frontend.onrender.com`).

---

## 5. Required Manual Configuration in Supabase

After your frontend is deployed to Render, configure Supabase Authentication:

1. In the **Supabase Dashboard**, open **Authentication** > **URL Configuration**.
2. Set **Site URL** to your frontend Render URL:
   ```text
   https://aloft-frontend.onrender.com
   ```
3. Under **Redirect URLs**, add:
   ```text
   https://aloft-frontend.onrender.com/**
   http://localhost:5173/**
   ```
4. Click **Save**.

### If Using Google OAuth:
1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Under your OAuth 2.0 Client IDs, ensure **Authorized redirect URIs** contains:
     ```text
     https://<your-supabase-project-id>.supabase.co/auth/v1/callback
     ```
2. In Supabase Dashboard:
   - Go to **Authentication > Providers > Google**.
   - Verify Google OAuth is enabled with your Client ID and Client Secret.

---

## 6. Verification & Health Check

1. **Verify Backend Health**:
   Visit `https://aloft-backend.onrender.com/api/health` in your browser.
   Output:
   ```json
   { "ok": true, "timestamp": "2026-09-05T..." }
   ```
2. **Verify Frontend UI**:
   Visit `https://aloft-frontend.onrender.com`.
   The authentication screen should load smoothly with no console errors.
3. Test signing up with email/password or Google OAuth.
4. Add tasks, habits, and switch themes to verify end-to-end functionality.

---

## 7. Troubleshooting

- **Free Tier Cold Starts**: Render puts free web services to sleep after 15 minutes of inactivity. When awakening, the backend can take ~30–50 seconds to respond on the very first request. The frontend static site is on a global CDN and never sleeps.
- **CORS Errors**: The backend automatically permits any origin ending in `.onrender.com`. If you configure a custom domain (e.g., `https://mycustomapp.com`), set `CORS_ORIGIN=https://mycustomapp.com` in your backend environment variables.
- **Missing Build Variables**: In Vite, `VITE_` environment variables are baked into static assets during build time. If you update `VITE_API_URL`, trigger a manual deploy with **Clear build cache & deploy** in Render.
