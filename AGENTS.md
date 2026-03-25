# Octave Skills Hub — AGENTS.md

This file gives Codex instant project context. Read this before making any changes.

## Self-Updating Instructions

**This file must be kept up to date.** After every session, if any of the following occurred, update this file before finishing:

- A new convention or pattern was established (e.g. how a component should be structured)
- A gotcha or bug was discovered and fixed
- A new route, component, or feature was added
- A decision was made about how something should work
- A dependency was added or changed
- The deploy setup changed

When updating, add the new information to the relevant section. Keep entries concise — one or two lines each. Do not remove existing entries unless they are factually wrong.

---

## What this is

An internal web app for the Octave team to discover, share, and AI-match Codex skills (.md files). Live at Vercel (frontend) + Railway (backend).

---

## Tech Stack

- **Frontend:** React + Vite, deployed on Vercel
- **Backend:** Node.js + Express + SQLite (better-sqlite3), deployed on Railway
- **AI:** Google Gemini API (gemini-2.0-flash) for skill matching
- **File uploads:** Multer, stored on Railway filesystem

---

## Folder Structure

```
skills-hub/
├── backend/
│   ├── server.js        # All API routes
│   ├── database.js      # SQLite setup and all queries
│   ├── backupService.js # Full backup/export + startup restore helpers
│   ├── .env             # GEMINI_API_KEY, ADMIN_PASSWORD, PORT, GitHub backup sync vars
│   └── uploads/         # Uploaded skill files (ephemeral on Railway)
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Routes: /, /upload, /guide, /admin
│   │   ├── index.css            # Global design system (CSS variables)
│   │   ├── components/
│   │   │   ├── Nav.jsx / Nav.css
│   │   │   ├── SkillCard.jsx / SkillCard.css
│   │   │   └── SkillModal.jsx / SkillModal.css
│   │   └── pages/
│   │       ├── Discover.jsx / Discover.css   # Main page with AI match bar
│   │       ├── Upload.jsx / Upload.css
│   │       ├── Guide.jsx / Guide.css
│   │       └── Admin.jsx / Admin.css
│   ├── .env.production  # VITE_API_URL=https://octave-skills-hub-production.up.railway.app
│   └── vite.config.js
└── scripts/
    ├── backup.js        # node scripts/backup.js — backs up all skills to JSON
    └── restore.js       # node scripts/restore.js — restores skills after redeploy
```

---

## Design System

Defined in `frontend/src/index.css` as CSS variables. Key values:

- `--pink: #E82AAE` — primary accent, buttons, active states
- `--teal: #26EA9F` / `--teal-text: #0A8A5C` — success, verified badges
- `--bg: #F4F4F0` — page background
- `--surface: #FFFFFF` — cards
- `--font-head: 'Jost'` / `--font-body: 'Lato'`

Always use these variables. Never hardcode colours except in the variables file itself.

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/skills` | Public | List all skills (`?q=search`, `?verified=true`) |
| GET | `/api/skills/:id` | Public | Single skill (includes file_content) |
| GET | `/api/skills/:id/download` | Public | Download .md file |
| POST | `/api/skills` | Public | Upload skill (multipart form) |
| DELETE | `/api/skills/:id` | Admin | Delete skill |
| GET | `/api/admin/pending` | Admin | Unverified skills |
| POST | `/api/admin/verify/:id` | Admin | Verify a skill |
| POST | `/api/admin/unverify/:id` | Admin | Unverify a skill |
| PATCH | `/api/admin/pairs/:id` | Admin | Update pairs_with |
| POST | `/api/admin/login` | — | Check admin password |
| GET | `/api/admin/backup` | Admin | Export full backup JSON including metadata + attachment content |
| POST | `/api/admin/restore` | Admin | Restore backup JSON into an empty database |
| POST | `/api/match` | Public | AI skill matching via Gemini |
| GET | `/api/health` | Public | Health check |

Admin routes require header: `x-admin-password: <ADMIN_PASSWORD>`

---

## Database Schema

Single table: `skills`

```sql
id, name, author, description, tags (JSON), filename, file_path,
file_content, created_at, downloads, verified (0/1), pairs_with (JSON array of IDs)
```

---

## Environment Variables

**Backend (.env):**
- `GEMINI_API_KEY` — Google Gemini API key
- `ADMIN_PASSWORD` — Admin panel password (default: octave-admin)
- `PORT` — Set in Railway dashboard
- `GITHUB_BACKUP_TOKEN` / `GITHUB_BACKUP_REPO` / `GITHUB_BACKUP_BRANCH` / `GITHUB_BACKUP_PATH` — optional GitHub sync for auto-backups that survive Railway redeploys

**Frontend (.env.production):**
- `VITE_API_URL` — Railway backend URL

---

## Deploy Workflow

Frontend (Vercel) auto-deploys on every git push to main.
Backend (Railway) auto-deploys on every git push to main.

```bash
git add .
git commit -m "description of change"
git push
```

If backend files changed, Railway redeploys automatically (~2 min).
If only frontend files changed, Vercel deploys (~30 sec).

If GitHub backup sync is configured, Railway restores the latest backup automatically on startup whenever the DB comes up empty after a redeploy.

---

## Key Conventions

- **Surgical changes only** — never rewrite a file unless the majority needs changing. Prefer targeted edits.
- **No unnecessary rewrites** — if changing one function, only touch that function.
- **CSS variables always** — use design system variables, never hardcode values.
- **Backend is synchronous** — better-sqlite3 queries are sync, no await needed on DB calls.
- **Tags and pairs_with stored as JSON strings** in SQLite, parsed to arrays when returned from API.
- **Verified skills** sort first in the list (ORDER BY verified DESC).
- **Backup format is source-of-truth JSON** — `scripts/skills-backup.json` now stores full skill records plus attachment content, and startup restore preserves original IDs so `pairs_with` survives intact.

---

## Common Gotchas

- Vite bakes `VITE_API_URL` at build time — changing it in Vercel requires a redeploy
- Railway filesystem is ephemeral — to make uploads survive redeploys, configure GitHub backup sync vars in Railway so each mutation updates `scripts/skills-backup.json` remotely and startup restore can repopulate an empty DB
- `better-sqlite3` requires Node native compilation — version pinned to `^11.9.1` for Node 25 compatibility
- Admin password defaults to `octave-admin` if `ADMIN_PASSWORD` env var not set
- `.skill` files are binary — cannot be parsed for auto-populate, user must fill fields manually
- Never use curly/smart quotes inside JSX attributes — Vite build will fail with "Expected >" error
- Modal overlay uses `align-items: flex-start` with `padding-top: 80px` to clear the navbar
- `GET /api/skills` returns `pairs_with` but not `file_content` — use `GET /api/skills/:id` for full detail including file_content
- `node scripts/backup.js` and `node scripts/restore.js` are now admin-backed fallbacks for exporting/restoring the same full backup payload the server uses automatically

---

## At-Scale Migration Notes (not done yet)

When moving to Azure:
- SQLite → Azure SQL or Cosmos DB (only `database.js` changes)
- Local uploads → Azure Blob Storage (only `server.js` upload handler changes)
- Open access → Azure AD via MSAL (frontend auth wrapper + Express middleware)
- Railway + Vercel → Azure App Service or Container Apps
