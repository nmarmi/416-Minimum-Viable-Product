# DraftIQ – Project Overview & Implementation Plan

## What This Project Does

**DraftIQ** is a full-stack **fantasy baseball draft** application. It supports:

- **Commissioners**: Create leagues, configure draft type (e.g. Auction), number of teams, and manage a league.
- **Players**: Create and manage leagues, see “My Leagues,” and enter a **Draft Room** for live auction drafting.
- **Draft Room**: Player pool (search/filter), roster building, live auction (nominate → bid → mark sold), team budgets, and settings — all currently using placeholder/filler content until the player data API is connected.

---

## Current Features (Implemented)

| Feature | Status |
|--------|--------|
| Auth (register, login, forgot password) | ✅ |
| Commissioner: create league workspace | ✅ |
| Player: create league, view league, list “My Leagues” | ✅ |
| Draft Room UI: tabs (Players, My Roster, Draft Board, Teams, Settings) | ✅ |
| Auction workflow UI (nominate, timer, bid, mark sold) | ✅ |
| Backend: MongoDB, auth, leagues CRUD | ✅ |

---

## What’s Left to Implement (Filler → Real Data)

1. **Player pool in Draft Room**  
   The “Players” tab shows an empty table with the message: *“Player pool data will render here once API integration is ready.”*  
   **Goal**: Back the table with real player/projection data from your CSVs.

2. **Player data source**  
   No player or projection model/API exists yet. We need:
   - A **player/projection** model and API.
   - **Ingest** one primary CSV (projections) into the app (DB or static API).

3. **Other filler areas** (can follow after player pool):
   - My Roster: “No rostered players yet” → real roster when draft picks are recorded.
   - Budget sidebar: “Awaiting draft data from API” → real budget when league/draft is wired.
   - Teams tab: placeholder teams → real league teams.
   - Recommendations: “Recommendations will appear after player pool data loads” → can use projection/value data later.

---

## Your Data Files

| File | Purpose | Best use in app |
|------|--------|------------------|
| **projections-NL.csv** | Projected stats (upcoming season) | **Primary** – main player pool for the draft (who to draft and projected stats). |
| **2025-player-NL-stats.csv** | Actual 2025 stats | “Current/last year” stats view, or for comparison vs projections. |
| **3Year-average-NL-stats.csv** | 3-year averages | “Historical” or “3Y avg” view; good for stability/trends. |

**CSV columns (all three):**  
`Player`, `AB`, `R`, `H`, `1B`, `2B`, `3B`, `HR`, `RBI`, `BB`, `K`, `SB`, `CS`, `AVG`, `OBP`, `SLG`, `FPTS`

**Player format:** `"Name Pos | TEAM"` (e.g. `Juan Soto OF | NYM`). We’ll parse this into **name**, **position(s)**, and **team** for the UI (Player, Pos, Team columns).

---

## How We’ll Use the Data

1. **Start with one source of truth: projections**  
   Use **projections-NL.csv** as the main “player pool” for the draft:
   - Ingest into DB (or serve via API from parsed CSV).
   - Expose a **GET /players** (or `/api/players`) that returns list of players with: name, team, position, and key stats (e.g. HR, RBI, R, SB, AVG, K, FPTS).
   - Draft Room “Players” tab calls this API and fills the table (with Value = FPTS; ADP/W/SV/ERA/WHIP can be “--” for now for batters).

2. **Later: add 2025 stats and 3-year average**  
   - Optional extra fields or endpoints (e.g. “last year”, “3Y avg”) so the UI can show comparisons.
   - Can be Phase 2 after the main pool works.

---

## Implementation Plan (Step-by-Step)

### Phase 1: Projections as the main player pool (current focus)

| Step | Task | Details |
|------|------|--------|
| 1 | **Player/Projection model (server)** | Mongoose schema: name, team, position(s), and stat fields from CSV (AB, R, H, HR, RBI, BB, K, SB, AVG, OBP, SLG, FPTS, etc.). Optional: `source: 'projection'`. |
| 2 | **Players API (server)** | `GET /players` with optional query params: `search`, `team`, `position`, `limit`, `offset`. Returns JSON array of players for the Draft Room. |
| 3 | **CSV import script (server)** | Script (e.g. `node scripts/import-projections.js`) that reads `projections-NL.csv`, parses “Player” into name/position/team, and inserts into MongoDB. Run once (or when CSV updates). |
| 4 | **Client: players API client** | Small module (e.g. `client/src/players/requests.js`) that calls `GET /players` with credentials, same pattern as leagues. |
| 5 | **Draft Room: load and display players** | In `DraftRoomScreen`, on “Players” tab (or on mount): fetch players from API, store in state, render table rows. Map: Player, Team, Pos, Value (FPTS), HR, RBI, R, SB, AVG; show “--” for ADP, W, SV, K (if not used), ERA, WHIP as needed. Optional: wire search input to API or client-side filter. |

### Phase 2 (later)

- Ingest **2025-player-NL-stats.csv** and/or **3Year-average-NL-stats.csv** (extra collections or fields).
- Add “View: Projected / 2025 / 3Y Avg” (or similar) in the UI.
- Wire “My Roster”, budget, and teams to league/draft state and APIs.

---

## File / Location Summary

- **Server**: `server/models/`, `server/routes/`, `server/controllers/`, `server/db/` (existing). Add: `Player` model, `players-router`, `players-controller`; optional `server/scripts/import-projections.js` and place CSV there or use env path.
- **Client**: `client/src/components/DraftRoomScreen.js` (Players tab), new `client/src/players/requests.js` (or under `api/`).
- **Data**: Use **projections-NL.csv** as the single source of truth for the player pool first; add other CSVs when we add “2025” / “3Y avg” views.

---

## Next Step

Implement **Phase 1**: Player model, players API, CSV import for `projections-NL.csv`, and Draft Room Players tab backed by that API. Then we can iterate on search/filters and, later, 2025/3Y data.
