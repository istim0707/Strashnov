# Finley
# https://finley-pruw.onrender.com #
Finley is a dependency-free fullstack prototype for a personal AI finance tracker with per-user profiles.

## Run

```powershell
node server.js
```

Open `http://localhost:4173`.

## AI classification

By default, Finley calls Pollinations through the OpenAI-compatible `https://text.pollinations.ai/openai` endpoint and falls back to local rules if the network is unavailable.

The default mode is hybrid: obvious phrases stay instant through local rules, while unclear categories go to LLM. To force LLM for every phrase, set `FINLEY_LLM_MODE=always`; to disable LLM entirely, set `FINLEY_LLM_MODE=off`.

For OpenAI, set:

```powershell
$env:OPENAI_API_KEY="..."
$env:OPENAI_MODEL="gpt-4o-mini"
node server.js
```

Users, sessions, budgets, and transactions are stored in `data/finley.json`. Passwords are stored as `scrypt` hashes with per-user salts, and browser sessions use an HttpOnly cookie.

## Supabase storage

For production, set Supabase variables on the host. When these variables exist, Finley stores users, sessions, categories, and transactions in Supabase instead of `data/finley.json`.

```powershell
$env:SUPABASE_URL="https://your-project.supabase.co"
$env:SUPABASE_SECRET_KEY="sb_secret_..."
node server.js
```

`SUPABASE_URL` can also include `/rest/v1`; Finley normalizes it automatically. Never commit `SUPABASE_SECRET_KEY` to GitHub.

## GitHub Pages

GitHub Pages can host only static files. Finley needs `server.js` for profiles, sessions, transactions, and AI categorization, so the full app should be deployed to a Node host such as Render, Railway, Fly.io, or a VPS.

You can still publish the static shell on GitHub Pages by uploading `public/`, but login, profiles, saving transactions, and AI classification will not work without a deployed backend.
