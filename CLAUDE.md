See @README.md, @docs/PLAN.md, and @docs/architecture-diagram.md.

## Project Description
DraftIQ is a fantasy baseball auction draft application with a React frontend (`client/`) and an Express + MongoDB backend (`server/`).

Core backend domains:
- **auth** — cookie-based JWT (register, login, logout, profile update)
- **leagues** — owner-scoped CRUD; each league has exactly one draft session
- **players** — player search/filter with optional licensed API fallback to MongoDB projections
- **draft-sessions** — full auction draft lifecycle: setup, active, paused, completed; tracks team budgets, roster slots, purchase history, and player pool availability

Player data comes from a licensed external Player Data API (`PLAYER_API_URL + PLAYER_API_KEY`) when configured, otherwise falls back to locally imported CSV projections in MongoDB.

## Repo Map
```
client/
  src/
    auth/              AuthContext + auth API requests
    store/             GlobalStoreContext (Flux-style: leagues + draft session)
    leagues/requests/  League CRUD requests
    players/requests   Player search + usage requests
    draft-sessions/requests  Draft session CRUD + purchases requests
    components/        Screen components (see Routes below)
    config/api.js      API base URL config from env vars
    glossary/          Glossary term definitions

server/
  auth/               JWT cookie verify/sign middleware
  controllers/        Request handlers (auth, league, players, draft-session)
  routes/             Express routers (auth, leagues, players, draft-sessions)
  models/             Mongoose models (User, League, Player, DraftSession)
  services/
    draft-service.js        Draft mutation logic (recordPurchase, undoPurchase, editPurchase, initializeDraft)
    player-pool-service.js  Player pool ID fetching + PlayerStub normalization
  db/
    DatabaseManager.js      Abstract DB interface
    mongodb/index.js        MongoDBManager (Mongoose implementation)
  lib/
    licensed-player-api.js  Client for external Player Data API
  scripts/
    import-projections.js   CSV → MongoDB import
  test/               Vitest tests (use mongodb-memory-server, no real DB)
```

## Client Routes
- `/` — SplashScreen (unauthenticated landing)
- `/home` — PlayerHomeScreen (league list + create/delete)
- `/login` — LoginScreen
- `/register` — RegisterScreen
- `/forgot-password` — ForgotPasswordScreen
- `/league/:leagueId/draft/:draftSessionId/setup` — DraftSessionSetupScreen (configure teams, roster slots, salary cap)
- `/league/:leagueId/draft-room/:draftSessionId` — DraftRoomScreen (live auction draft)
- `/league/:leagueId/draft-room` — DraftRoomScreen (legacy, no session attached)

## Backend API Endpoints
- `POST /auth/register`, `POST /auth/login`, `GET /auth/logout`, `GET /auth/loggedIn`, `PUT /auth/update`
- `POST /leagues`, `GET /leagues`, `DELETE /leagues/:leagueId`
- `GET /players?search=&team=&position=&limit=&offset=`, `POST /players/usage`
- `POST /draft-sessions`
- `GET /draft-sessions/:draftSessionId`
- `PUT /draft-sessions/:draftSessionId`
- `GET /draft-sessions/:draftSessionId/players?status=available|purchased|all&search=&position=&team=&limit=&offset=`
- `GET /draft-sessions/:draftSessionId/valuations`
- `POST /draft-sessions/:draftSessionId/purchases`

## State Management
- **AuthContext** (`client/src/auth/index.js`): user session, login/logout/register, error state
- **GlobalStoreContext** (`client/src/store/index.js`): Flux-style reducer; holds `leagues[]`, `currentLeague`, `currentDraftSession`. All cross-screen server data lives here. Local UI state (modals, search inputs) stays inside each component.

## Data Models
- **User**: email, userName, passwordHash, avatar
- **League**: name, owner (ObjectId → User), draftSessionId (string)
- **Player**: playerId, playerName, team, position, source ('projection'|'2025'|'3year'), batting stats (ab/r/h/hr/rbi/bb/k/sb/cs/avg/obp/slg/fpts), status
- **DraftSession**: draftSessionId (string), leagueId, createdBy, status ('setup'|'active'|'paused'|'completed'), myTeamId, nominationOrder, pooledAt, leagueSettings {numberOfTeams, salaryCap, rosterSlots, scoringType, draftType}, teams[], availablePlayerIds[], purchasedPlayerIds[], draftHistory[]

## Player Data Sources
- **Licensed API** (preferred): set `PLAYER_API_URL` + `PLAYER_API_KEY`. Used by `/players`, `/draft-sessions/:id/players`, `/draft-sessions/:id/valuations`, and player pool init.
- **MongoDB fallback** (dev/no-API): projection CSV imported via `node server/scripts/import-projections.js`. Used automatically when `PLAYER_API_URL` is not set.

## Canonical Commands
- install server deps: `cd server && npm install`
- install client deps: `cd client && npm install`
- run server: `cd server && npm start`
- run client: `cd client && npm start`
- run server tests: `cd server && npm test`  (Vitest, mongodb-memory-server)
- run client tests: `cd client && CI=true npm test`  (Jest)
- import projections: `node server/scripts/import-projections.js`

## Working Rules
- Do not read or modify real `.env` files
- Prefer small targeted changes over broad rewrites
- Preserve existing route/controller/model structure on the server
- Keep client requests in `client/src/*/requests*`
- When changing draft room behavior, verify player search/load flow
- Draft business logic (purchase validation, budget/slot enforcement) belongs in `server/services/draft-service.js`, not in controllers
- All test files go in a `test/` folder (server: `server/test/`, client: `client/src/test/`)
