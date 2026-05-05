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

Local keys:
- `NODE_ENV` (`development`)
- `PORT` (example: `5000`)
- `MONGODB_URI` (Mongo connection string, local default: `mongodb://127.0.0.1:27017/findit`)
- `SESSION_SECRET` (long random secret string)
- `SESSION_DAYS` (session duration, e.g. `7`)

## Vercel Environment Variables

In Vercel, add these under Project Settings -> Environment Variables:

- `MONGODB_URI`: hosted MongoDB connection string, for example from MongoDB Atlas. Do not use `127.0.0.1` or `localhost` on Vercel.
- `SESSION_SECRET`: a long random secret string. Do not use the placeholder from `.env.example`.
- `SESSION_DAYS`: optional session duration, for example `7`.

You do not need to add `PORT` on Vercel. Vercel supplies the runtime port. You also usually do not need to add `NODE_ENV`; Vercel runs production deployments with production settings.

If you use MongoDB Atlas, make sure the database user exists and Network Access allows Vercel to connect. For a quick student-project setup, Atlas Network Access commonly uses `0.0.0.0/0`, but restrict it more tightly if your deployment setup supports that.

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
