## Overview

DraftIQ is a fantasy baseball draft application (commissioners, players, live auction draft room). See **PLAN.md** for features, remaining work, and how player data (CSV projections) is used.

### Run the app

1. **Install and env**
   - `cd server && npm install` then create `server/.env` with `MONGODB_CONNECT` and `JWT_SECRET`.
   - `cd client && npm install`.

2. **Import player projections (once)**
   - Copy `projections-NL.csv` into `server/data/` or pass its path:
   - `node server/scripts/import-projections.js`
   - Or: `node server/scripts/import-projections.js /path/to/projections-NL.csv`

3. **Start server and client**
   - Terminal 1: `cd server && npm start`
   - Terminal 2: `cd client && npm start`
   - Open http://localhost:3000, sign in, join a league, open Draft Room → **Players** tab to see the pool.
