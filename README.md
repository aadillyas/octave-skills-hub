# Skills Hub

An internal web application for your team to discover, share, and AI-match Claude skills.

## What it does

- **Discover** — Browse and search all uploaded skills by name, tag, or author
- **Upload** — Share your own `.md` skill files with the team
- **AI Match** — Describe a problem in plain English; Gemini AI recommends the best matching skills
- **Guide** — Step-by-step instructions for loading skills into Claude
- **Auto backup + restore** — The backend snapshots the full skills library after uploads/admin changes and can restore it automatically on deploy

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A Gemini API key → [Get one free at aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Setup (first time only)

### 1. Clone or download this project

```bash
cd ~/Documents   # or wherever you keep projects
# place the skills-hub folder here
cd skills-hub
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and replace `your_gemini_api_key_here` with your actual Gemini API key:

```
GEMINI_API_KEY=AIza...your_key_here
```

Optional but recommended for production auto-backups on Railway:

```env
GITHUB_BACKUP_TOKEN=github_pat_...
GITHUB_BACKUP_REPO=owner/repo
GITHUB_BACKUP_BRANCH=main
GITHUB_BACKUP_PATH=scripts/skills-backup.json
```

With those set, every upload/admin metadata change writes a fresh `scripts/skills-backup.json` locally and syncs it to GitHub. On Railway startup, if the SQLite DB is empty, the backend restores from the latest GitHub backup automatically.

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

---

## Running the app

You need two terminal windows open at the same time.

### Terminal 1 — Backend

```bash
cd skills-hub/backend
node server.js
```

You should see:
```
✅ Skills Hub API running at http://localhost:3001
```

### Terminal 2 — Frontend

```bash
cd skills-hub/frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## Project structure

```
skills-hub/
├── backend/
│   ├── server.js        # Express API — all routes
│   ├── database.js      # SQLite setup
│   ├── .env             # Your API key (never commit this)
│   ├── .env.example     # Template for the above
│   ├── skills-hub.db    # Auto-created SQLite database
│   └── uploads/         # Uploaded .md files stored here
└── frontend/
    └── src/
        ├── pages/
        │   ├── Discover.jsx   # Browse skills
        │   ├── Upload.jsx     # Upload a skill
        │   ├── AIMatch.jsx    # AI matching
        │   └── Guide.jsx      # How-to guide
        └── components/
            ├── Nav.jsx
            └── SkillCard.jsx
```

---

## API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/skills` | List all skills (supports `?q=search`) |
| GET | `/api/skills/:id` | Get a single skill |
| GET | `/api/skills/:id/download` | Download the .md file |
| POST | `/api/skills` | Upload a new skill (multipart form) |
| DELETE | `/api/skills/:id` | Delete a skill |
| GET | `/api/admin/backup` | Export full backup JSON (admin only) |
| POST | `/api/admin/restore` | Restore full backup JSON into an empty DB (admin only) |
| POST | `/api/match` | AI skill matching |
| GET | `/api/health` | Health check |

---

## At-scale roadmap

### Azure AD authentication
When you're ready to add login, the plan is:
1. Register an app in **Azure Portal → App registrations**
2. Add `@azure/msal-react` to the frontend
3. Wrap the React app in `MsalProvider`
4. Add token validation middleware to Express

### Azure OpenAI (replace Gemini)
Swap the Gemini client in `server.js` with the Azure OpenAI SDK.
The `.env.example` already has the placeholder variables ready:
```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=your_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

### Production database
Replace SQLite with PostgreSQL — only `database.js` needs to change.

### File storage
Replace the local `uploads/` folder with Azure Blob Storage.

---

## Backup Notes

- `scripts/skills-backup.json` now stores full skill data, including `verified`, `pairs_with`, `downloads`, timestamps, and attachment content
- `node scripts/backup.js` downloads a full backup from the live backend admin endpoint
- `node scripts/restore.js` is now an emergency fallback that posts the saved backup back to the live backend if its DB is empty

## Troubleshooting

**"Could not connect to the Skills Hub server"**
→ Make sure the backend (`node server.js`) is running in a separate terminal

**"Gemini API key not configured"**
→ Check your `backend/.env` file has the key set correctly

**Port already in use**
→ Change `PORT=3001` in `.env` and update the proxy in `vite.config.js` to match
