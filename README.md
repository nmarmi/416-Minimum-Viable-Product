## Overview

DraftIQ is a fantasy baseball auction draft application. Users create leagues, configure draft settings, and run auction drafts with real-time budget and roster tracking.

See [`docs/PLAN.md`](docs/PLAN.md) for features and remaining work, and [`docs/PLAYER-DATA-API.md`](docs/PLAYER-DATA-API.md) for the licensed player data integration.

---

### Run the app locally

1. **Install dependencies**
   ```bash
   cd server && npm install
   cd client && npm install
   ```

2. **Configure the server** — create `server/.env`:
   ```env
   MONGODB_CONNECT=mongodb://127.0.0.1:27017/draftiq
   JWT_SECRET=your-secret
   PORT=4000
   CORS_ORIGINS=http://localhost:3000
   ```

3. **Import player projections (once, for local dev without the licensed API)**
   ```bash
   node server/scripts/import-projections.js
   ```

4. **Start**
   ```bash
   # Terminal 1
   cd server && npm start

   # Terminal 2
   cd client && npm start
   ```
   Open http://localhost:3000.

---

### Run the tests

**Server** (Vitest, uses mongodb-memory-server — no real DB needed):
```bash
cd server
npm test
```

**Client** (Jest via react-scripts):
```bash
cd client
CI=true npm test
```

---

### CI/CD (GitHub Actions)

Every push to `main` runs the full test suite. Deployment only happens if all tests pass.

| Workflow | File | Trigger |
|---|---|---|
| CI — Automated Tests | `.github/workflows/auto-testing.yml` | push or PR to `main` |
| CD — Deploy | `.github/workflows/deploy.yml` | CI passes on `main` |

**Deploys to:**
- **Vercel** — frontend (`client/`)
- **Render** — backend (`server/`)

Vercel's Git integration is disconnected and Render's auto-deploy is disabled. GitHub Actions is the only deploy path, so broken code cannot reach production.

**Required GitHub secrets:**

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | vercel.com → Account Settings → your User ID |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → Project ID |
| `RENDER_DEPLOY_HOOK_URL` | Render → service → Settings → Deploy Hook |

---

### Licensed Player Data API (optional)

To use the external player data API instead of local MongoDB projections, add to `server/.env`:

```env
PLAYER_API_URL=https://player-data-api.vercel.app
PLAYER_API_KEY=your-key
```

When configured, the backend calls:
- `GET /players` — searchable player list
- `GET /players/:playerId` — single player lookup
- `GET /api/v1/players/pool` — full player pool for draft session availability
- `POST /api/v1/players/valuations` — z-score auction dollar values based on league settings
- `POST /usage` — usage event tracking

To cache normalized player metadata in MongoDB's `PlayerStub` collection:

```bash
npm run sync:players --prefix server
```

For scheduled syncs, run the same script with `--watch` and optionally set
`PLAYER_METADATA_SYNC_INTERVAL_MINUTES` (defaults to 360 minutes):

```bash
PLAYER_METADATA_SYNC_INTERVAL_MINUTES=360 npm run sync:players --prefix server -- --watch
```

See [`docs/PLAYER-DATA-API.md`](docs/PLAYER-DATA-API.md) for full setup and testing instructions.

---

### Environment variables

**Server (`server/.env`)**

| Variable | Required | Description |
|---|---|---|
| `MONGODB_CONNECT` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `PORT` | No | Server port (default: 4000) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:3000`) |
| `PLAYER_API_URL` | No | Licensed player data API base URL |
| `PLAYER_API_KEY` | No | Licensed player data API key |
| `PLAYER_METADATA_SYNC_INTERVAL_MINUTES` | No | Interval for `sync:players -- --watch` (default: 360) |

**Client (`.env` or Vercel env)**

| Variable | Description |
|---|---|
| `REACT_APP_API_BASE_URL` | Backend base URL — sets all API routes at once |
| `REACT_APP_API_URL` | Auth API base (overrides `REACT_APP_API_BASE_URL/auth`) |
| `REACT_APP_LEAGUES_API_URL` | Leagues API base |
| `REACT_APP_PLAYERS_API_URL` | Players API base |
| `REACT_APP_DRAFT_SESSIONS_API_URL` | Draft sessions API base |

For same-domain Vercel proxy deployments, no `REACT_APP_*` vars are needed — the client proxies all API requests through Vercel rewrites.
