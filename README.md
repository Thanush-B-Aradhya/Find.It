# FindIt (USN Login Edition)

A simple lost-and-found web app with:
- Frontend: `index.html`, `styles.css`, `app.js`
- Backend: `Node.js + Express`
- Database: `MongoDB`
- Auth: fixed USN/password list loaded from `data/allowedUsers.json`

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create local env file:
- Copy `.env.example` to `.env`
- Fill values in `.env`

3. Start the app:
```bash
npm start
```

4. Open:
`http://localhost:5000`

## Why both `.env` and `.env.example`?

- `.env`: your real local secrets and values (machine-specific, private).
- `.env.example`: sample template showing required keys (safe to commit).

Your `.gitignore` excludes `.env`, so secrets are not pushed.

## Environment Variables

Required keys:
- `NODE_ENV` (`development` or `production`)
- `PORT` (example: `5000`)
- `MONGODB_URI` (Mongo connection string)
- `SESSION_SECRET` (long random secret string)
- `SESSION_DAYS` (session duration, e.g. `7`)

## Directory Guide

- `config/`
  - `db.js`: MongoDB connection setup.

- `data/`
  - `allowedUsers.json`: allowed login credentials (USN/password list).

- `lib/`
  - `auth.js`: auth helpers (session token, cookie helpers, USN normalization).
  - `allowedUsers.js`: loads and validates USN/password credentials.

- `middleware/`
  - `auth.js`: session loader and `requireAuth`.

- `models/`
  - `Item.js`: Mongo model for lost/found posts.
  - `Session.js`: Mongo model for login sessions.

- `routes/`
  - `auth.js`: login/session/logout APIs.
  - `items.js`: item CRUD APIs with ownership enforcement.

- `scripts/`
  - `import-users-from-xlsx.ps1`: imports Excel users into `data/allowedUsers.json`.

- Root files
  - `server.js`: app entrypoint (Express server + route wiring).
  - `index.html`, `styles.css`, `app.js`: client UI.
  - `vercel.json`: Vercel deployment route config.
  - `package.json`: dependencies and npm scripts.

## Update Allowed Users from Excel

Run:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\import-users-from-xlsx.ps1
```

Then restart server.
