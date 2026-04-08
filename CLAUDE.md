See @README.md, @PLAN.md, and @docs/architecture-diagram.md.

## Project Description
DraftIQ is a fantasy baseball draft application with a React frontend (`client/`) and an Express + MongoDB backend (`server/`).
It should support players creating and editing leagues, and managing draft purchases in the league.
Core backend domains are auth, leagues, and players.
Player data comes either from MongoDB-imported projection CSV data or an optional licensed external Player Data API, depending on environment variables.
Authentication is cookie-based JWT.
Current work is centered on making the draft room and player data flows reliable rather than redesigning the architecture.


## Repo Map
- `client/`: React frontend
- `server/`: Express API + MongoDB
- Auth is cookie-based JWT
- Player data comes from MongoDB or optional licensed API via env vars

## Canonical Commands
- install server deps: `cd server && npm install`
- install client deps: `cd client && npm install`
- run server: `cd server && npm start`
- run client: `cd client && npm start`
- run server tests: `cd server && npm test`
- import projections: `node server/scripts/import-projections.js`

## Working Rules
- Do not read or modify real `.env` files
- Prefer small targeted changes over broad rewrites
- Preserve existing route/controller/model structure on the server
- Keep client requests in `client/src/*/requests*`
- When changing draft room behavior, verify player search/load flow
