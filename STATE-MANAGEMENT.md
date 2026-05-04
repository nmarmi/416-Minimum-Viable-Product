# DraftIQ — State Management Walkthrough

This document explains every layer of state in the project, in the order a request flows from the browser, through the draft kit backend, all the way to the Player Data API and back.

---

## Layer 1 — Browser: Authentication State

**File:** `client/src/auth/index.js`

Auth state is held in its own React Context, completely separate from the rest of the app's data. This lets every screen (login, navbar, protected routes) know who's logged in without passing props around.

### How it works

A `createContext()` call makes a container, and an `AuthContextProvider` component wraps the whole app to provide the data:

```5:14:client/src/auth/index.js
const AuthContext = createContext();

function AuthContextProvider(props) {
    const history = useHistory();
    const [authState, setAuthState] = useState({
        user: null,
        loggedIn: false,
        loading: true,
        errorMessage: null
    });
```

The provider exposes methods like `loginUser`, `registerUser`, `logoutUser` that call the backend and then update `authState` based on the response:

```36:54:client/src/auth/index.js
    const loginUser = async (email, password) => {
        const response = await authRequestSender.loginUser(email, password);

        if (response.status === 200) {
            setAuthState({
                user: response.data.user,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            history.push("/home");
            return;
        }
```

When the app first loads, `getLoggedIn` runs once via `useEffect` to check if a session cookie is already valid:

```98:100:client/src/auth/index.js
    useEffect(() => {
        getLoggedIn();
    }, []);
```

### State stored here

| Field | Purpose |
|---|---|
| `user` | Current user object (id, username, email) |
| `loggedIn` | Boolean — protects routes |
| `loading` | True while the initial session check is in flight |
| `errorMessage` | Surfaces login/register errors to the UI |

---

## Layer 2 — Browser: Global App State

**File:** `client/src/store/index.js`

Once logged in, the user's leagues and the active draft session need to be accessible from multiple screens (league list, draft setup, draft room). The `GlobalStoreContext` holds this cross-screen data using the **Flux pattern** — state only changes through defined actions processed by a reducer.

### The store shape

```34:38:client/src/store/index.js
    const [store, setStore] = useState({
        leagues: [],
        currentLeague: null,
        currentDraftSession: null,
    });
```

### The reducer

Every state change is a typed action routed through `storeReducer`:

```47:56:client/src/store/index.js
    const storeReducer = (action) => {
        const { type, payload } = action;
        switch (type) {
            case GlobalStoreActionType.LOAD_LEAGUES: {
                return setStore({
                    leagues: payload,
                    currentLeague: store.currentLeague,
                    currentDraftSession: store.currentDraftSession,
                });
            }
```

### Async methods

Each store method calls the backend first, then updates state with the response. The store never invents its own truth — it mirrors whatever MongoDB returns:

```180:189:client/src/store/index.js
    store.recordPurchase = async function (draftSessionId, { playerId, playerName, teamId, price }) {
        const res = await recordPurchaseRequest(draftSessionId, { playerId, playerName, teamId, price });
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.RECORD_PURCHASE,
                payload: res.data.draftSession,
            });
        }
        return res;
    };
```

### State stored here

| Field | Purpose |
|---|---|
| `leagues` | All leagues owned by the current user |
| `currentLeague` | The league the user is viewing |
| `currentDraftSession` | The full draft session — teams, budgets, picks, available players |

---

## Layer 3 — Browser: Local UI State (per-component)

**File:** `client/src/components/DraftRoomScreen.js`

Anything that's only relevant to a single screen — search inputs, open modals, loading flags, selected tabs — stays local to that component via `useState`. It never goes in the global store.

### Examples

```47:62:client/src/components/DraftRoomScreen.js
    const [activeTab, setActiveTab] = useState('Players');
    const [entryPlayer, setEntryPlayer] = useState('');
    const [entryNominatedBy, setEntryNominatedBy] = useState(FALLBACK_TEAMS[0]);
    const [entryWonBy, setEntryWonBy] = useState(FALLBACK_TEAMS[0]);
    const [entryPrice, setEntryPrice] = useState('');
    const [players, setPlayers] = useState([]);
    const [playersTotal, setPlayersTotal] = useState(0);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [showGlossary, setShowGlossary] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
```

### Why it stays local

If `playersLoading` or `playerSearch` were in the global store, every component subscribed to the store would re-render every time someone typed a character into the search box. Keeping UI state local keeps re-renders scoped to the component that cares.

### Other hooks used here

- `useContext` — reads the global store from Layer 2
- `useEffect` — triggers side effects (load session on mount, reload players on tab change)
- `useCallback` — caches functions so they don't trigger infinite effect loops
- `useMemo` — caches computed values like team dropdown options

---

## Layer 4 — Browser → Draft Kit: Client Requests

**File:** `client/src/draft-sessions/requests.js` (also `auth/requests/index.js`, `leagues/requests/index.js`, `players/requests.js`)

Whenever a store action needs to modify persistent state, it calls a function in a `requests.js` file. These are thin wrappers around the browser's built-in `fetch` API that send HTTP calls to the draft kit Express backend.

### The pattern

```5:32:client/src/draft-sessions/requests.js
async function request(path, method = "GET", body = null) {
    try {
        const options = {
            method,
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(`${BASE_URL}${path}`, options);
```

`credentials: "include"` sends the auth cookie with every request so the backend knows who you are.

### The endpoints

```51:54:client/src/draft-sessions/requests.js
export const createDraftSession = async (payload) => request("/", "POST", payload);
export const getDraftSession = async (draftSessionId) => request(`/${draftSessionId}`, "GET");
export const updateDraftSession = async (draftSessionId, payload) => request(`/${draftSessionId}`, "PUT", payload);
export const recordPurchase = async (draftSessionId, payload) => request(`/${draftSessionId}/purchases`, "POST", payload);
```

---

## Layer 5 — Draft Kit Server: Controllers

**File:** `server/controllers/draft-session-controller.js`

The Express server receives the HTTP request, validates the user, and coordinates the business logic. Controllers are the entry point for all server-side state changes.

### Example: handling a purchase

```337:376:server/controllers/draft-session-controller.js
const recordPurchase = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { draftSessionId } = req.params;
        const { playerId, playerName, teamId, price } = req.body || {};

        if (!playerId || !teamId || price == null) {
            return res.status(400).json({ success: false, errorMessage: 'playerId, teamId, and price are required.' });
        }
        ...
        const result = await draftService.recordPurchase(draftSessionId, { playerId, playerName, teamId, price: parsedPrice });
```

Controllers don't hold state themselves — they just pass data along to services and the database.

---

## Layer 6 — Draft Kit Server: Services (Transactional Logic)

**File:** `server/services/draft-service.js`

This is where the **transactional state changes** happen. Every pick is an all-or-nothing update — all fields change together, or none do.

### The transaction for a purchase

```185:207:server/services/draft-service.js
    session.availablePlayerIds = session.availablePlayerIds.filter((id) => id !== playerIdStr);
    session.purchasedPlayerIds.push(playerIdStr);

    team.budgetRemaining -= price;
    team.purchasedPlayers.push({ playerId: playerIdStr, price });

    if (slotKey) {
        team.filledRosterSlots.set(slotKey, (team.filledRosterSlots.get(slotKey) || 0) + 1);
    }

    session.nominationOrder = (session.nominationOrder || 0) + 1;
    session.draftHistory.push({
        purchaseId: DraftSession.generatePurchaseId(),
        playerId: playerIdStr,
        playerName: finalName,
        teamId,
        price,
        positionFilled: slotKey,
        nominationOrder: session.nominationOrder
    });

    session.markModified('teams');
    await session.save();
```

All five things happen together:
1. Player removed from available pool
2. Player added to purchased list
3. Team budget debited
4. Roster slot filled
5. Draft history appended

Then the whole session is saved to MongoDB in one atomic operation.

---

## Layer 7 — Draft Kit Server: Persistent State (MongoDB)

**File:** `server/db/mongodb/index.js` (interface: `server/db/DatabaseManager.js`)

MongoDB is the **source of truth**. If data isn't in here, it doesn't exist as far as the system is concerned. Everything else is a copy.

### What it stores

- **Users** — accounts, hashed passwords, profile data
- **Leagues** — league name, owner, linked draft session
- **DraftSessions** — the entire draft state: teams, budgets, picks, available players, history

### Example save operation

```90:101:server/db/mongodb/index.js
    async createDraftSession(sessionData) {
        const session = new DraftSession(sessionData);
        return await session.save();
    }

    async getDraftSessionById(draftSessionId) {
        return await DraftSession.findOne({ draftSessionId }).lean();
    }

    async saveDraftSession(draftSession) {
        return await draftSession.save();
    }
```

### Why it's separate from everything else

MongoDB runs as a persistent service outside the Express server. This is why the draft kit backend has to be hosted on Render (where processes stay alive and maintain DB connections) rather than Vercel (where functions are ephemeral).

---

## Layer 8 — Draft Kit Server → Player Data API: Server-to-Server Requests

**File:** `server/lib/licensed-player-api.js`

When the draft kit needs player data (stats, valuations, the initial player pool), it calls the Player Data API as a separate licensed service. This is a **backend-to-backend** call — the browser is not involved.

### Configuration

```6:11:server/lib/licensed-player-api.js
const baseUrl = process.env.PLAYER_API_URL || '';
const apiKey = process.env.PLAYER_API_KEY || '';

function hasConfig() {
    return Boolean(baseUrl && apiKey);
}
```

### Authentication — both headers sent for compatibility

```13:19:server/lib/licensed-player-api.js
function getHeaders() {
    return {
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
}
```

### Fetching the player pool

```97:110:server/lib/licensed-player-api.js
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/pool${query ? `?${query}` : ''}`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: getHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || data.errorMessage || `Player Data API responded with ${res.status}`);
            err.status = res.status;
            err.upstream = data;
            throw err;
        }
        return data;
    }
```

Note this is the same `fetch` API the browser uses — Node.js supports it natively.

---

## Layer 9 — Draft Kit Server: Pool Service (State Sync Logic)

**File:** `server/services/player-pool-service.js`

This sits between the controllers and the licensed API client. It's responsible for seeding the `availablePlayerIds` field in MongoDB from the Player Data API when a draft session first becomes active.

### The critical state handoff

```52:82:server/services/player-pool-service.js
async function fetchPoolPlayerIds() {
    if (licensedApi.hasConfig()) {
        let data;
        try {
            data = await licensedApi.getPlayerPool();
        } catch (err) {
            throw new PlayerPoolUnavailableError(
                `Player Data API unavailable: ${err.message}`,
                err
            );
        }

        const players = Array.isArray(data?.players) ? data.players : [];
        const seen = new Set();
        const playerIds = [];
        for (const p of players) {
            const id = String(p.playerId || p.id || '').trim();
            if (id && !seen.has(id)) {
                seen.add(id);
                playerIds.push(id);
            }
        }

        return {
            playerIds,
            pooledAt: new Date(),
            source: 'player-data-api',
            dataAsOf: data?.dataAsOf || null,
            staleWarnings: data?.staleWarnings || []
        };
    }
```

Once this runs, the player IDs are saved to MongoDB and become the source of truth for "who's draftable" in that session. The Player Data API is never asked this question again for this draft.

---

## Layer 10 — Player Data API: Stateless Computation

**Files:**
- `player-data-api/src/app.js` (Express setup)
- `player-data-api/src/services/valuationEngine.js` (the math)
- `player-data-api/src/db/connection.js` (SQLite reader)

The Player Data API is the opposite of the draft kit — it holds no state between requests. Every request arrives with all the context it needs, the API computes a result, returns it, and forgets everything. This is why it can run on Vercel's serverless platform.

### Stateless pattern — full state in, result out

```46:86:player-data-api/src/controllers/valuationsController.js
function getValuations(req, res) {
  const { leagueSettings = {}, draftState = {} } = req.body || {};
  ...
  try {
    const { valuations, meta } = runValuations(leagueSettings, draftState);

    if (valuations.length > 0) {
      return res.json({
        success: true,
        valuations,
        meta,
        ...freshness(),
      });
    }
```

The draft kit passes `draftState.availablePlayerIds` with every call, and the API uses it to filter which players to value.

### The only "state" here is read-only reference data

```104:128:player-data-api/src/services/valuationEngine.js
function loadStatRows(season, group) {
  const db = tryGetDb();
  if (db) {
    try {
      const rows = db.prepare(`
        SELECT
          p.player_id, p.name, p.positions, p.mlb_team, p.status, p.is_available,
          ps.games_played, ps.ab, ps.r,  ps.h,  ps.hr, ps.rbi, ps.bb,
          ps.k,  ps.sb, ps.avg, ps.obp, ps.slg, ps.ops,
          ps.w,  ps.l,  ps.era, ps.whip, ps.k9, ps.ip, ps.sv, ps.hld
        FROM players p
        JOIN player_stats ps ON p.player_id = ps.player_id
        WHERE ps.season = ? AND ps.stat_group = ?
      `).all(season, group);
      if (rows.length) return rows;
    } catch (_) {}
  }

  // Fallback to bundled JSON when DB is unavailable (e.g. Vercel serverless)
  const allRows = loadFallbackStats();
```

SQLite (or the bundled JSON fallback) holds player stats and metadata. This data is read-only at runtime — it only gets updated during deployments or explicit admin refreshes.

---

## The Full State Flow — A Purchase End-to-End

Here's what happens when a user drafts a player at auction for $45:

```
┌───────────────────────────────────────────────────────────────────────┐
│ 1. BROWSER                                                            │
│    User clicks "Submit" in DraftRoomScreen                            │
│    Local useState: entryPrice='45', entryWonBy='fantasy-team-1'       │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 2. GLOBAL STORE                                                       │
│    Calls store.recordPurchase() which calls recordPurchaseRequest()   │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 3. CLIENT REQUEST                                                     │
│    draft-sessions/requests.js fires:                                  │
│    POST /draft-sessions/draft-123/purchases                           │
│    credentials: include (sends auth cookie)                           │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 4. DRAFT KIT CONTROLLER                                               │
│    draft-session-controller.js verifies user, validates body,         │
│    delegates to draftService.recordPurchase()                         │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 5. DRAFT SERVICE (TRANSACTION)                                        │
│    - Remove player from availablePlayerIds                            │
│    - Add to purchasedPlayerIds                                        │
│    - Debit team budget                                                │
│    - Fill roster slot                                                 │
│    - Append to draftHistory                                           │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 6. MONGODB                                                            │
│    session.save() — the transaction commits atomically                │
└──────────────────┬────────────────────────────────────────────────────┘
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ 7. RESPONSE TRAVELS BACK                                              │
│    MongoDB → Service → Controller → HTTP response → Global Store      │
│    Store replaces currentDraftSession with the updated version        │
│    React re-renders the draft room with the player marked as taken    │
└───────────────────────────────────────────────────────────────────────┘

OPTIONAL — if the UI needs to refresh valuations:
┌───────────────────────────────────────────────────────────────────────┐
│ 8. DRAFT KIT → PLAYER DATA API (server-to-server)                     │
│    licensed-player-api.js:                                            │
│    POST /api/v1/players/valuations                                    │
│    Body: { draftState: { availablePlayerIds: [...] } }                │
│    Player Data API computes valuations and returns result.            │
│    It never stores the draft state — it's passed in fresh every time. │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Summary Table

| Layer | Where | What It Holds | Lifetime | Architecture Pattern |
|---|---|---|---|---|
| 1. Auth Context | Browser | Current user, login status | Session | React Context |
| 2. Global Store | Browser | Leagues, current draft session | Session | Flux / React Context |
| 3. Local UI State | Browser | Inputs, modals, loading flags | Component mount | React `useState` |
| 4. Client Requests | Browser → Server | (Transport only) | Per request | `fetch` |
| 5. Controllers | Draft Kit Server | (Transport only) | Per request | Express routes |
| 6. Services | Draft Kit Server | Business rules / transactions | Per request | Transactional logic |
| 7. MongoDB | Database | Users, leagues, draft sessions | Permanent | Source of truth |
| 8. Licensed API Client | Draft Kit Server → Player Data API | (Transport only) | Per request | `fetch` + API key |
| 9. Pool Service | Draft Kit Server | Bridge: copies pool IDs from API → MongoDB | Per draft init | State sync |
| 10. Player Data API | Serverless (Vercel) | Read-only stats (SQLite/JSON) | Deployment | Stateless computation |

---

## Key Takeaway: Distributed State Management

The project uses **distributed state management** — state isn't in one place, it's split across systems that each own a specific piece:

- **Browser** owns *view* state (what's displayed, what you've typed)
- **Draft Kit + MongoDB** own *transactional* state (your draft, your picks, your budget)
- **Player Data API** owns *reference* state (who the players are, what their stats are)

The glue that makes this work is the **stateless request pattern** — every call includes the full context needed to produce a result, so no service needs to remember anything about what another service is doing.
