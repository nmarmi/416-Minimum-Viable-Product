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

### Deploy frontend to Vercel (single-domain setup)

1. Create a Vercel project with **Root Directory** set to `client`.
2. In `client/vercel.json`, replace `https://<your-draftiq-backend-domain>` with your deployed DraftIQ backend URL.
3. Deploy and attach your custom domain to this frontend project.

In this setup, the frontend calls same-origin paths (`/auth`, `/leagues`, `/players`), and Vercel proxies those paths to your backend.

### Full-stack deployment (what users need)

To give users full functionality from one web domain:

1. Deploy **DraftIQ backend** (`server`) to a Node host (Render/Railway/Fly/another Vercel project).
2. Configure backend env vars:
   - `MONGODB_CONNECT` (Atlas URI)
   - `JWT_SECRET`
   - `CORS_ORIGINS` (include your frontend domain and `http://localhost:3000` for local dev)
   - `PLAYER_API_URL=https://player-data-api.vercel.app` (licensed player API URL)
   - `PLAYER_API_KEY=...` (if required by licensed API)
3. Deploy **frontend** (`client`) to Vercel with rewrites from `client/vercel.json`.

Flow at runtime:
- User browser -> frontend domain (Vercel static app)
- Frontend same-origin requests -> Vercel rewrites -> DraftIQ backend (`/auth`, `/leagues`, `/players`)
- DraftIQ backend -> MongoDB Atlas + licensed Player Data API (`PLAYER_API_URL`)

`https://player-data-api.vercel.app` is only for licensed player data integration, not for `/auth` or `/leagues`.

### Licensed Player Data API (optional)

To use the external **licensed Player Data API** (pull + push) instead of local MongoDB player data:

1. Run the licensed API (e.g. at `http://localhost:4001`) and note its license key.
2. In **server/.env** add:
   ```env
   PLAYER_API_URL=http://localhost:4001
   PLAYER_API_KEY=your-secret-key
   ```
   (Use the same value as `API_LICENSE_KEY` in the API’s `.env` — e.g. `your-secret-key` if that’s what the API uses.)
3. Restart the draft kit server. It will:
   - **Pull**: Proxy `GET /players` to the licensed API (player pool comes from the API).
   - **Push**: When a user opens the draft room, the app calls `POST /players/usage`; the draft kit backend forwards this to the API’s `POST /usage`.
4. If `PLAYER_API_URL` is not set, the draft kit keeps using local MongoDB player data (and push is no-op).

### How to test (licensed API + draft kit)

1. **Start the licensed API** (in the API repo): e.g. `npm start` so it runs at `http://localhost:4001`. Leave it running.
2. **Set draft kit env**: In `server/.env` you must have `PLAYER_API_URL=http://localhost:4001` and `PLAYER_API_KEY=your-secret-key`. Restart the draft kit server after changing `.env`.
3. **Start the draft kit**: Terminal 1: `cd server && npm start` (port 4000). Terminal 2: `cd client && npm start` (port 3000).
4. **Test pull (players from API)**  
   - Open http://localhost:3000, sign in, go to a league, click **Join Draft Room**.  
   - Open the **Players** tab. You should see the player list coming from the licensed API (same data as the API’s stand-in list). If you see players and a count (e.g. “20 Players”), pull is working.
5. **Test push (usage to API)**  
   - With the draft room open, the app sends a usage event when the draft room loads. In the **licensed API** server logs (or whatever it uses to record `POST /usage`), you should see a request with body like `{ "event": "draft_room_open", "timestamp": "...", "metadata": {} }`. If the API logs or stores that, push is working.
6. **Quick API check (optional)**  
   - In a terminal:  
     `curl -s -H "X-API-Key: your-secret-key" http://localhost:4001/players?limit=5`  
   - You should get JSON with `success: true` and a `players` array.  
   - Then:  
     `curl -s -X POST -H "X-API-Key: your-secret-key" -H "Content-Type: application/json" -d '{"event":"test","timestamp":"2026-03-07T12:00:00Z"}' http://localhost:4001/usage`  
   - You should get a success response. If both work, the draft kit will work as long as env and servers are correct.
