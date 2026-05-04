# DraftIQ — Draft Kit User Stories & Execution Plan

## Product Vision

The Draft Kit is an **auction draft assistant** for a single fantasy baseball drafter. It tracks the live auction state: player availability, team budgets, purchase history, and roster slots. It is NOT a league manager or commissioner platform.

## Relationship to Player Data API

The Player Data API repo owns player data, seed datasets, valuations, and recommendations. The Draft Kit consumes player data from that API. During early development before integration, the Draft Kit uses a local copy of the seed data produced by the Player Data API repo.

---

## Execution Order

Work is sequenced so each layer builds on the previous one with no blocked work.

### Phase 1: Strip League-Manager Code
- US-0.1, US-0.2, US-0.3, US-0.4, US-0.5
- No dependencies. Pure removal/cleanup work.

### Phase 2: Build Domain Models
- US-2.1, US-2.2, US-2.3 (US-2.4 superseded — see story for details)
- Depends on: Phase 1 (clean codebase)

### Phase 3: Player Pool via Player Data API
- US-3.2, US-3.3
- Depends on: Phase 2 (session model complete per the US-2.7–2.9 alignment note)
- Note: No local seed import. On draft start the Draft Kit calls `GET /api/v1/players/pool` on the Player Data API and persists `availablePlayerIds`.

### Phase 4: Session CRUD Endpoints
- US-8.1, US-8.2, US-8.3, US-8.4, US-8.8
- Depends on: Phase 2 (DraftSession model exists)

### Phase 5: Draft Setup UI
- US-1.1, US-1.2, US-1.3, US-1.4, US-1.5, US-1.6, US-1.7, US-1.8
- Depends on: Phase 4 (endpoints to call)

### Phase 6: Draft State Service Logic
- US-2.5, US-2.6, US-2.7, US-2.8, US-2.9
- Depends on: Phase 2 (models), Phase 3 (player data exists)

### Phase 7: Purchase Mutation Endpoints
- US-8.5, US-8.6, US-8.7
- Depends on: Phase 6 (state service)

### Phase 8: Client State Architecture
- US-9.1, US-9.2, US-9.3
- Depends on: Phase 4 and Phase 7 (endpoints exist)

### Phase 9: Purchase Recording UI
- US-4.1, US-4.2, US-4.3, US-4.4
- Depends on: Phase 8 (DraftContext), Phase 7 (purchase endpoint)

### Phase 10: Undo/Edit UI
- US-5.1, US-5.2, US-5.3, US-5.4
- Depends on: Phase 9 (purchase UI working)

### Phase 11: Views
- US-6.1, US-6.2, US-6.3, US-6.4, US-6.5, US-6.6
- Depends on: Phase 8 (DraftContext provides data)

### Phase 12: Validation & Integrity (Milestone 2)
- US-7.1, US-7.2, US-7.3, US-7.4, US-7.5
- Depends on: Phase 6 (state service to test)

### Phase 13: Polish & UX (Milestone 2)
- US-10.1, US-10.2, US-10.3, US-10.4, US-10.5
- Depends on: Phases 9–11 (UI exists to polish)

### Phase 14: API Integration Readiness (Milestone 3)
- US-11.1, US-11.2, US-11.3, US-11.4, US-11.5, US-11.6, US-11.7, US-11.8
- Depends on: Player Data API placeholder endpoints (US-2.4, 2.5 in that repo), versioned routes (US-2.6), legacy-route deprecation headers (US-2.8), and the recommendations bugfix (US-2.9)

### Phase 15: External Data Consumption (Milestone 4)
- US-12.1, US-12.2, US-12.3
- Depends on: Phase 14 (licensed-API client can reach `/pool`, `/valuations`, etc.) and Player Data API ingestion jobs (Epic 4 in that repo)

### Phase 16: Valuation & Recommendations (Milestone 5)
- US-13.1, US-13.2, US-13.3, US-13.4
- Depends on: Phase 14 (client methods exist), Phase 15 (data is flowing), and Player Data API valuation engine (Epics 5–6 in that repo)

### Phase 17: End-to-End Validation (Milestone 5)
- US-14.1, US-14.2, US-14.3
- Depends on: Phases 14–16 (full integration surface exists to test)

---

## Epic 0: Product Realignment — Remove League-Manager Assumptions

### US-0.1: Remove commissioner role and home screen
**As a** drafter, **I want** the app to stop presenting commissioner vs. player role selection, **so that** the experience is focused on a single drafter using the tool.

**Acceptance criteria:**
- `RegisterScreen` no longer prompts for role (commissioner/player)
- `CommissionerHomeScreen` is removed or unreachable from navigation
- `HomeWrapper` routes directly to a draft-oriented home instead of branching by role
- `AuthContext` no longer stores or checks `role`
- The `AppBanner` no longer shows a role pill

** COMPLETED**

### US-0.2: Remove commissioner league workspace
**As a** drafter, **I want** the commissioner league management screen removed, **so that** the app does not present features irrelevant to draft assistance.

**Acceptance criteria:**
- `CommissionerLeagueScreen` is removed or unreachable
- Route `/commissioner-league/:leagueId` is removed from `App.js`
- Manager approval, announcement broadcast, draft pause/resume (commissioner controls) are gone
- Audit log for commissioner actions is gone

** COMPLETED**

### US-0.3: Rescope league as a single-owner draft container
**As a** drafter, **I want** the `League` entity kept but reduced to an owner-scoped container that holds exactly one draft session, **so that** "create a league, then draft inside it" remains the user flow without any pretense of multi-user league management.

> Revised from "remove league invite/join flow." The implementation kept `League` as a 1:1 wrapper around a `DraftSession` (see `CLAUDE.md` repo map and the `/league/:leagueId/draft/:draftSessionId/setup` route). The acceptance criteria below reflect the chosen approach.

**Acceptance criteria:**
- `League` model retains only `name`, `owner` (ObjectId → User), `draftSessionId` (string)
- `inviteCode`, `members[]`, `pendingMembers[]`, role/permission, and any commissioner fields are removed
- `POST /leagues/join` endpoint and join-by-code UI are removed
- `GET /leagues` returns only leagues where `owner === req.user._id`
- `PlayerHomeScreen` lists the authenticated user's leagues with create/delete only
- Each league maps 1:1 to a draft session (creating a league creates the session; deleting a league deletes the session)

** COMPLETED**

### US-0.4: Remove season/standings/schedule concepts
**As a** drafter, **I want** all references to seasons, standings, and schedules removed, **so that** the product clearly focuses on the draft and doesn't carry dead code.

**Acceptance criteria:**
- `League` model fields `seasonYear`, `isActive`, `leagueMode`, `scoringConfig` (and anything not listed in US-0.3) are removed
- No UI references to "season", "standings", "schedule", or post-draft play
- No controllers, routes, or models exist for standings/schedules
- Tests no longer exercise those code paths

** COMPLETED**

### US-0.5: Clean up unused server dependencies
**As a** developer, **I want** unused packages (`sequelize`, `pg`, `pg-hstore`, duplicate `bcrypt`/`bcryptjs`) removed from `server/package.json`, **so that** the dependency tree reflects actual usage.

**Acceptance criteria:**
- `sequelize`, `pg`, `pg-hstore` removed from `package.json`
- Only one of `bcrypt` / `bcryptjs` remains (whichever controllers actually use)
- `npm install` succeeds with no extraneous packages

** COMPLETED**

---

## Epic 1: Draft Session Setup

### US-1.1: Create a new draft session
**As a** drafter, **I want** to create a new draft session with a name, **so that** I can begin configuring my auction draft.

**Acceptance criteria:**
- A "Create Draft" action is available from the home screen
- User provides a draft session name
- System creates a `DraftSession` record with `status: "setup"` and `createdAt` timestamp
- User is taken to the draft session configuration screen
- `draftSessionId` is generated and stored

** COMPLETED**

### US-1.2: Configure number of teams
**As a** drafter, **I want** to specify how many teams are in my league (e.g. 10, 12, 14), **so that** budgets and roster math are correct.

**Acceptance criteria:**
- Numeric input for `numberOfTeams` (min 2, max 30)
- Value persists in `LeagueSettings` within the draft session
- Changing the number regenerates the `teams[]` array to match

** COMPLETED**

### US-1.3: Configure salary cap
**As a** drafter, **I want** to set the salary cap per team (e.g. $260), **so that** budget tracking is accurate.

**Acceptance criteria:**
- Numeric input for `salaryCap` (min 1)
- Value persists in `LeagueSettings`
- Each team's `budgetRemaining` initializes to this value

** COMPLETED**

### US-1.4: Configure roster slots
**As a** drafter, **I want** to define roster slot counts by position (C, 1B, 2B, 3B, SS, OF, UTIL, SP, RP, BENCH), **so that** the app can track filled vs. open slots.

**Acceptance criteria:**
- UI shows each position with a numeric input for slot count
- Values persist in `LeagueSettings.rosterSlots`
- Total roster size is computed and displayed
- Default values are provided (e.g. standard 23-slot roster)

** COMPLETED**

### US-1.5: Set scoring type placeholder
**As a** drafter, **I want** to select a scoring type label (e.g. "5x5 Roto", "H2H Categories", "Points"), **so that** the session records my league format for later use.

**Acceptance criteria:**
- Dropdown or radio with common scoring type options
- Value persists in `LeagueSettings.scoringType`
- This is informational only for now (no scoring calculations)

** COMPLETED**

### US-1.6: Draft type defaults to auction
**As a** drafter, **I want** the draft type to default to "AUCTION" and be displayed but not editable (for now), **so that** the entire app is oriented around auction drafts.

**Acceptance criteria:**
- `LeagueSettings.draftType` is set to `"AUCTION"`
- Displayed as read-only in settings UI
- No snake/linear draft option exists

** COMPLETED**

### US-1.7: Name fantasy teams
**As a** drafter, **I want** to assign names to each fantasy team, **so that** I can identify who is purchasing players during the draft.

**Acceptance criteria:**
- For each team (based on `numberOfTeams`), a text input for team name
- Default names are `fantasy-team-1`, `fantasy-team-2`, etc.
- User can rename any team (e.g. "Eric's Team", "Table 3 Guy")
- Each team gets a `teamId` in the format `fantasy-team-{n}`

** COMPLETED**

### US-1.8: Initialize draft session
**As a** drafter, **I want** to finalize setup and start the draft, **so that** the session transitions from setup to active.

**Acceptance criteria:**
- A "Start Draft" button validates settings are complete (teams > 0, cap > 0, at least one roster slot)
- `DraftSession.status` transitions from `"setup"` to `"active"`
- All teams are initialized with `budgetRemaining = salaryCap`, empty `purchasedPlayers[]`, and zeroed `filledRosterSlots`
- `availablePlayerIds[]` is populated from the player pool
- User is taken to the active draft view

** COMPLETED**

---

## Epic 2: Domain Model & Draft State Service

### US-2.1: Create DraftSession server model
**As a** developer, **I want** a `DraftSession` Mongoose model, **so that** draft state is persisted.

**Acceptance criteria:**
- Schema includes: `draftSessionId`, `name`, `createdAt`, `leagueSettings` (embedded), `teams[]` (embedded), `draftHistory[]` (embedded), `availablePlayerIds[]`, `purchasedPlayerIds[]`, `status` (enum: setup, active, paused, completed)
- Model is exported and registered with Mongoose

** COMPLETED**

### US-2.2: Create FantasyTeam embedded schema
**As a** developer, **I want** a `FantasyTeam` sub-schema, **so that** each team's budget and roster are tracked within the draft session.

**Acceptance criteria:**
- Fields: `teamId`, `teamName`, `budgetRemaining`, `purchasedPlayers[]` (array of `{playerId, price}`), `filledRosterSlots` (map of position to count)
- Embedded within `DraftSession.teams[]`

** COMPLETED**

### US-2.3: Create DraftPurchase embedded schema
**As a** developer, **I want** a `DraftPurchase` sub-schema, **so that** each purchase is recorded in ordered history.

**Acceptance criteria:**
- Fields: `purchaseId`, `playerId`, `playerName`, `teamId`, `price`, `timestamp`, `nominationOrder`
- Embedded within `DraftSession.draftHistory[]`
- `nominationOrder` auto-increments per session

** COMPLETED**

### US-2.4: ~~Create PlayerStub model (local cache of Player Data API)~~ — SUPERSEDED
**Status:** **SUPERSEDED by US-3.3.** No local `PlayerStub` collection is required. The Draft Kit hydrates players on demand from `GET /api/v1/players/pool` via the `player-pool-service.js` proxy. Caching, if ever needed, will be added as a separate story under Epic 12 behind a feature flag.

**Why superseded:** maintaining a local `PlayerStub` collection would require a sync job and risk staleness against the Player Data API's `dataAsOf`. The proxy-and-intersect approach keeps the Player Data API as the single source of truth.

### US-2.5: Implement draft state service — initialize draft
**As a** developer, **I want** a server-side draft state service that initializes a draft, **so that** business logic is separated from route handlers.

**Acceptance criteria:**
- `initializeDraft(sessionId)` sets all teams' budgets, marks all players available, sets status to active
- Returns the initialized draft snapshot
- Validation: fails if session is already active

** COMPLETED**

### US-2.6: Implement draft state service — record purchase
**As a** developer, **I want** the draft state service to record a purchase, **so that** all state changes happen atomically.

**Acceptance criteria:**
- `recordPurchase(sessionId, {playerId, teamId, price})` performs:
  - Validates player is available
  - Validates team has sufficient budget
  - Validates team has open roster slots
  - Marks player unavailable (moves to `purchasedPlayerIds`)
  - Deducts price from team's `budgetRemaining`
  - Appends to `draftHistory[]`
  - Adds player to team's `purchasedPlayers[]`
  - Increments `filledRosterSlots` for the player's position
- Returns updated draft snapshot

** COMPLETED**

> **Model alignment note (applies to US-2.7, 2.8, 2.9):** The current `server/models/draft-session-model.js` still predates stories US-2.1–2.3. Before implementing the service methods below, extend the schema to match what US-2.1–2.3 already promised:
> - add `draftHistory: [DraftPurchaseSchema]`
> - add `purchasedPlayerIds: [String]`
> - extend `status` enum to `['setup', 'active', 'paused', 'completed']`
> - add `nominationOrder` (auto-increment counter on the session)
> - add `myTeamId: String` (used by US-6.5)

### US-2.7: Implement draft state service — undo purchase
**As a** developer, **I want** the draft state service to undo a purchase, **so that** mistakes can be corrected.

**Acceptance criteria:**
- `undoPurchase(sessionId, purchaseId)` performs:
  - Finds the purchase in `draftHistory[]`
  - Restores player to `availablePlayerIds`
  - Restores budget to the team
  - Removes player from team's `purchasedPlayers[]`
  - Decrements `filledRosterSlots`
  - Removes or marks the history entry as undone
- Returns updated draft snapshot

** COMPLETED**

### US-2.8: Implement draft state service — edit purchase
**As a** developer, **I want** the draft state service to edit a purchase (change price or team), **so that** recording errors can be fixed without full undo.

**Acceptance criteria:**
- `editPurchase(sessionId, purchaseId, {newPrice?, newTeamId?})` performs:
  - If price changed: adjusts old team's budget (refund old, deduct new)
  - If team changed: moves player between teams, adjusts both budgets
  - Updates `draftHistory[]` entry
  - Validates new values (budget sufficient, etc.)
- Returns updated draft snapshot

** COMPLETED**

### US-2.9: Implement draft state service — get snapshot
**As a** developer, **I want** a function that returns the current draft snapshot, **so that** views can render the latest state.

**Acceptance criteria:**
- `getDraftSnapshot(sessionId)` returns:
  - List of available players with basic info
  - List of purchased players with price and team
  - Each team's remaining budget, purchased players, filled slots
  - Ordered draft history
  - Session status

** COMPLETED**

---

## Epic 3: Player Pool — Sourced from the Player Data API

> Note: US-3.1 (create seed dataset) has been removed. The Player Data API owns the pool. With the Player Data API live and serving `GET /api/v1/players/pool`, the Draft Kit **does not** import or store a local JSON seed. Stories below describe pulling the pool on demand.

### US-3.2: Populate `availablePlayerIds` from the Player Data API pool
**As a** drafter, **I want** a new draft session's available player pool to come from the Player Data API, **so that** the pool is always in sync with the upstream source of truth and the Draft Kit doesn't carry a stale seed.

**Acceptance criteria:**
- When a draft session transitions from `setup` to `active` (US-1.8 / US-8.4), the server calls `GET /api/v1/players/pool` on the Player Data API
- `availablePlayerIds` is populated from the response's `players[].playerId` (format `mlb-{id}`)
- A `pooledAt` timestamp is stored on the session so the client can warn if the pool is older than N hours
- If the Player Data API is unreachable and `PLAYER_API_URL` is unset, fall back to the legacy MongoDB `Player` collection's IDs (documented as a dev-only fallback)
- If the Player Data API is unreachable and `PLAYER_API_URL` **is** set, the endpoint returns `503` with a clear "Player Data API unavailable" message — the session is **not** transitioned to `active`

** COMPLETED**

### US-3.3: Expose player details to the draft room via a proxied endpoint
**As a** drafter, **I want** the draft room's Players tab to render rich player details (name, team, positions, status), **so that** I can search and bid without a separate API dance.

**Acceptance criteria:**
- `GET /api/draft-sessions/:sessionId/players?status=available` returns available players for the session
- Implementation proxies `GET /api/v1/players/pool` (or `GET /api/v1/players` with filters) and intersects with `session.availablePlayerIds`
- Supports optional `search`, `position`, `team` query filters (passed through to the Player Data API where supported)
- Returns `PlayerStub` shape: `playerId`, `name`, `positions[]`, `mlbTeam`, `status`, `isAvailable` (derived from session availability, not from the upstream field)
- Pagination via `limit` and `offset`
- No local `PlayerStub` collection is required — if caching is added later, it is added as a separate story under Epic 12

** COMPLETED**

---

## Epic 4: Purchase Recording (UI)

### US-4.1: Record a purchase from the draft board
**As a** drafter, **I want** to select a player, select a team, enter a price, and record the purchase, **so that** the draft state updates in real time.

**Acceptance criteria:**
- Draft Board tab has fields: player (autocomplete from available players), team (dropdown of session teams), price (numeric)
- "Record Purchase" button is enabled when all fields are filled
- On submit, calls the record purchase API
- On success: form clears, views refresh, success feedback shown
- On validation error (budget exceeded, player unavailable): error message displayed, no state change

** COMPLETED** (`DraftRoomScreen.js#renderDraftBoardTab` — player autocomplete + auctioned-by/won-by team dropdowns + price input; "Record Purchase" disabled until all filled; `handleRecordPurchase` calls `store.recordPurchase`, clears the form on success and surfaces server `errorMessage` inline on failure.)

### US-4.2: Player autocomplete filters to available players only
**As a** drafter, **I want** the player search in the purchase form to only show available (unpurchased) players, **so that** I cannot accidentally re-select a purchased player.

**Acceptance criteria:**
- Autocomplete queries only players where `isAvailable === true`
- Previously purchased players do not appear in suggestions
- If the user types a purchased player's name, no results appear

** COMPLETED** (`searchDraftBoardPlayers()` filters by `isAvailable()` against the `availableSet` derived from `draftSession.availablePlayerIds`; the API fallback path applies the same filter so server-side suggestions also exclude purchased players.)

### US-4.3: Team dropdown reflects session teams
**As a** drafter, **I want** the team dropdown in the purchase form to list the actual teams from my draft session, **so that** I select the correct buyer.

**Acceptance criteria:**
- Dropdown is populated from `DraftSession.teams[]`
- Shows team name and remaining budget (e.g. "Eric's Team ($238)")
- Updates after each purchase to show current budget

** COMPLETED** (`teamOptions` memoized selector renders `${getTeamName(t)} ($${t.budgetRemaining})`; live updates flow through the store's `RECORD_PURCHASE` reducer when the server returns the refreshed session.)

### US-4.4: Price validation on purchase
**As a** drafter, **I want** the app to validate that the purchase price does not exceed the team's remaining budget (accounting for $1 minimums for remaining roster slots), **so that** invalid purchases are prevented.

**Acceptance criteria:**
- Maximum allowed bid = `budgetRemaining - (openRosterSlots - 1)` (every unfilled slot needs at least $1)
- If entered price exceeds max bid, show inline validation error
- Price must be >= $1
- Price must be a whole number

** COMPLETED** (`maxBid = budgetRemaining - (openSlots - 1)` computed from the selected won-by team and roster config; `priceError` rejects non-integers, `< 1`, and overruns; error renders inline next to the price input and disables the submit button until cleared.)

---

## Epic 5: Undo/Edit Purchase (UI)

### US-5.1: Undo the most recent purchase
**As a** drafter, **I want** to undo the last recorded purchase with one click, **so that** I can quickly fix a mistake.

**Acceptance criteria:**
- An "Undo Last" button is visible in the draft board header
- Clicking it calls the undo API for the most recent `draftHistory` entry
- Player returns to available pool
- Team budget is restored
- Draft history entry is removed
- Button is disabled if history is empty

** COMPLETED** (header ⟲ button in `DraftRoomScreen` is `disabled={!draftSession?.draftHistory?.length}`; `handleUndoLastPurchase` resolves the last `purchaseId` and routes through `confirmAndUndo` so it shares the same prompt + server call as the per-row Undo. State reversal happens server-side via `draft-service.undoPurchase`.)

### US-5.2: Undo any purchase from draft history
**As a** drafter, **I want** to undo any specific purchase from the draft history log, **so that** I can correct errors found later.

**Acceptance criteria:**
- Each row in the draft history table has an "Undo" action
- Clicking it calls the undo API for that specific `purchaseId`
- All state effects are reversed (availability, budget, roster)
- The history list re-renders without that entry
- Confirmation prompt before undo ("Are you sure?")

** COMPLETED** (each draft-history row has an Undo button that calls `handleUndoRowPurchase`, which routes through `confirmAndUndo` — a `window.confirm("Undo {player} to {team} for $${price}?")` prompt; on accept, calls `store.undoPurchase` which fires the server `DELETE /draft-sessions/:id/purchases/:purchaseId`. Cancel aborts with no state change.)

### US-5.3: Edit a purchase price
**As a** drafter, **I want** to edit the price of a recorded purchase, **so that** I can fix a typo without undoing and re-entering.

**Acceptance criteria:**
- Each row in draft history has an "Edit" action
- Clicking it opens an inline or modal editor for price (and optionally team)
- On save, calls the edit purchase API
- Budgets adjust (old team gets refund of difference, or new team is charged)
- Validation applies (new price must be affordable)

** COMPLETED** (Edit button on each row triggers `handleStartEdit` which swaps the row to inline editors for team + price. `handleSaveEdit` validates: integer ≥ $1, and `projectedBudget = currentBudget + refundIfSameTeam − newPrice` must be ≥ remaining open slots × $1. On client validation failure, an inline `editError` renders next to the price field and the Save button is held; on server failure (e.g. roster full), the upstream `errorMessage` is surfaced in the same slot. Server `PUT /draft-sessions/:id/purchases/:purchaseId` handles the budget delta.)

### US-5.4: Edit the purchasing team of a purchase
**As a** drafter, **I want** to change which team a purchase is assigned to, **so that** I can fix a team-selection error.

**Acceptance criteria:**
- The edit modal/inline allows changing the team dropdown
- On save: old team's budget is restored, new team's budget is charged
- Player moves from old team's roster to new team's roster
- Validation: new team must have sufficient budget and open roster slots

** COMPLETED** (the inline editor includes a team `<select>` populated from `teamOptions` (showing `{teamName} ($budget)`); the same `handleSaveEdit` validation path checks the destination team — when the team changes (`!sameTeam`), the projection uses the new team's full budget without refund, and roster capacity is checked from `purchasedPlayers.length + 1 ≤ totalSlots`. The server's `editPurchase` does the actual roster-slot swap.)

---

## Epic 6: Basic Views

### US-6.1: Available players view
**As a** drafter, **I want** to see all available (unpurchased) players in a searchable, filterable table, **so that** I know who is still on the board.

**Acceptance criteria:**
- Players tab shows only available players
- Columns: Player Name, Positions, MLB Team, (optionally projected stats)
- Search by name filters the list
- Filter by position filters the list
- Count of available players is displayed
- Purchased players are excluded

** COMPLETED** (`renderPlayersTab` table; `displayedPlayers` memo filters by `availableSet` (from `draftSession.availablePlayerIds`), the new `positionFilter` chip row, and the existing `injuryOnly` toggle. Count pill renders `${displayedPlayers.length} of ${availableSet.size} Available` so it tracks the live state, not the stale API total.)

### US-6.2: Purchased players view
**As a** drafter, **I want** to see all purchased players with their buyer and price, **so that** I can track what has been drafted.

**Acceptance criteria:**
- A "Purchased" view/tab shows all purchased players
- Columns: Player Name, Positions, Team That Bought, Price
- Sortable by price, team, or order of purchase
- Count of purchased players displayed

** COMPLETED** (new `Purchased` tab + `renderPurchasedTab` shows every `draftHistory` row with #, Player, Position, Team That Bought, Price; sort chips for `order | price | team`; count pill in the header tracks `draftHistory.length`.)

### US-6.3: Team budgets view
**As a** drafter, **I want** to see every team's remaining budget, roster slots filled, and max bid, **so that** I can gauge the competitive landscape.

**Acceptance criteria:**
- Teams tab shows all fantasy teams in the session
- For each team: name, budget remaining, budget spent, roster slots filled / total, max possible bid
- Max bid = `budgetRemaining - (openSlots - 1)`
- Updates in real time after each purchase

** COMPLETED** (`renderTeamsTab` is now a real table: Team / Budget Remaining / Budget Spent (`salaryCap − budgetRemaining`) / Slots Filled (`filled / target`) / Max Bid (`budgetRemaining − (openSlots − 1)`). Updates flow live via the store's `RECORD_PURCHASE`/`UPDATE_DRAFT_SESSION` reducers.)

### US-6.4: Draft history view
**As a** drafter, **I want** to see the ordered log of all purchases, **so that** I can review what happened in the draft.

**Acceptance criteria:**
- Draft Board tab shows a table of all purchases in chronological order
- Columns: #, Player Name, Team, Price, Timestamp
- Most recent purchase is at the top
- Each row has Undo and Edit actions (from Epic 5)
- Empty state: "No picks recorded yet"

** COMPLETED** (`renderDraftBoardTab` "Draft Results Log" table — # / Player / Auctioned By / Won By / Price / Notes / Actions; per-row Undo + Edit (Epic 5); empty state renders "No picks logged yet".)

### US-6.5: My team view / roster
**As a** drafter, **I want** to designate one team as "my team" and see my roster and budget prominently, **so that** I can focus on my own draft strategy.

**Acceptance criteria:**
- User can mark one team as "My Team" (persisted in session or locally)
- Sidebar budget tracker shows "My Team" budget, max bid, avg $/remaining slot
- "My Roster" tab shows my purchased players by position slot
- Filled vs. open slots are clearly indicated

** COMPLETED** (server `updateDraftSession` accepts `myTeamId`; client store action `setMyTeam` posts via `PUT /draft-sessions/:id`. UI: "Set as Mine" button on each row of the Teams tab AND a button-row picker in the My Roster tab. `myTeam` derivation falls back to the first team when nothing is marked. Roster tab shows a Position / Filled / Target / Open table plus a list of purchased players + price for that team. Sidebar binds to `myTeam` for Remaining Budget, Maximum Bid (using live open slots), and Avg $/Open Slot.)

### US-6.6: Sidebar budget tracker updates live
**As a** drafter, **I want** the sidebar budget tracker to update immediately after every purchase, **so that** I always see current numbers.

**Acceptance criteria:**
- Remaining budget updates on purchase/undo/edit
- Max bid recalculates
- Avg $/player and avg budget/slot recalculate
- Roster planning section shows filled/open per position

---

## Epic 7: State Validation & Integrity (Milestone 2)

### US-7.1: Prevent duplicate player purchases
**As a** drafter, **I want** the system to reject a purchase if the player is already purchased, **so that** the draft state stays consistent.

**Acceptance criteria:**
- Server returns 400 with clear error message if `playerId` is in `purchasedPlayerIds`
- UI shows the error inline
- No state change occurs

### US-7.2: Prevent budget overrun
**As a** drafter, **I want** the system to reject a purchase if the team cannot afford it, **so that** budgets remain valid.

**Acceptance criteria:**
- Server validates `price <= team.budgetRemaining - (openSlots - 1)`
- Returns 400 with "Insufficient budget" if violated
- UI shows the error inline

### US-7.3: Prevent roster overflow
**As a** drafter, **I want** the system to reject a purchase if the team's roster is full, **so that** no team exceeds their roster size.

**Acceptance criteria:**
- Server validates that the team has at least one open roster slot
- Returns 400 with "Roster full" if all slots are filled
- Optionally: position-specific enforcement

### US-7.4: Validate draft session status before mutations
**As a** developer, **I want** all mutation endpoints to check that the draft session is active, **so that** completed or paused drafts cannot be modified.

**Acceptance criteria:**
- `recordPurchase`, `undoPurchase`, `editPurchase` reject if `status !== "active"`
- Returns 400 with "Draft is not active"
- Setup-phase sessions also reject purchases

### US-7.5: State consistency tests
**As a** developer, **I want** automated tests for draft state transitions, **so that** regressions are caught early.

**Acceptance criteria:**
- Tests cover: initialize, purchase, undo, edit, double-purchase rejection, budget overrun rejection, roster full rejection
- Tests verify that `availablePlayerIds.length + purchasedPlayerIds.length === totalPlayers` after every operation
- Tests verify that `sum of all team budgets spent + all team budgets remaining === numberOfTeams * salaryCap`
- Tests run in CI (vitest)

---

## Epic 8: API Routes for Draft Operations

### US-8.1: Create draft session endpoint
**As a** developer, **I want** `POST /api/draft-sessions` to create a new draft session.

**Acceptance criteria:**
- Accepts `{name}` in body
- Returns created session with ID and default settings
- Requires authentication

** COMPLETED**

### US-8.2: Get draft session endpoint
**As a** developer, **I want** `GET /api/draft-sessions/:id` to return the full draft snapshot.

**Acceptance criteria:**
- Returns full `DraftSession` including teams, history, available/purchased counts
- Requires authentication
- Returns 404 if not found

** COMPLETED**

### US-8.3: Update draft settings endpoint
**As a** developer, **I want** `PUT /api/draft-sessions/:id/settings` to update league settings.

**Acceptance criteria:**
- Accepts `{numberOfTeams, salaryCap, rosterSlots, scoringType, teams}`
- Only allowed when `status === "setup"`
- Returns updated session

** COMPLETED**

### US-8.4: Explicit start-draft endpoint
**As a** developer, **I want** an explicit `POST /draft-sessions/:id/start` action that idempotently transitions a `setup` session to `active`, **so that** clients have a clear, intentional moment of "the draft has begun" instead of relying on the side-effect of a `GET`.

> **Current state:** lazy initialization is implemented inside `GET /draft-sessions/:id` — when a `setup` session is fetched, the controller hydrates `availablePlayerIds` from `/api/v1/players/pool`. That is enough to make the draft room work, but it (a) makes a "setup vs. active" transition implicit, (b) couples a read endpoint to a write/state-changing side-effect, and (c) makes the 503-on-API-failure path inconsistent (a read shouldn't fail if the upstream pool is down). This story tracks promoting that into a real action.

**Acceptance criteria:**
- New `POST /draft-sessions/:draftSessionId/start` route + controller
- Validates all settings are complete (teams > 0, cap > 0, at least one roster slot, all team names set)
- On success: calls `draft-service.initializeDraft(sessionId)`, populates `availablePlayerIds` from `GET /api/v1/players/pool`, sets `status` to `"active"`, sets `pooledAt` timestamp, returns initialized snapshot
- Idempotent for already-`active` sessions (returns the current snapshot, no error) — but `400` for `paused` or `completed`
- On Player Data API failure with `PLAYER_API_URL` set, returns `503` with `{ success: false, errorMessage: "Player Data API unavailable" }` and does **not** transition the session
- `GET /draft-sessions/:id` no longer initializes the pool as a side-effect — it only reads
- Client `DraftSessionSetupScreen` "Start Draft" button POSTs to this endpoint

** COMPLETED**

### US-8.5: Record purchase endpoint
**As a** developer, **I want** `POST /api/draft-sessions/:id/purchases` to record a purchase.

**Acceptance criteria:**
- Accepts `{playerId, teamId, price}`
- Runs full validation (availability, budget, roster)
- Returns updated draft snapshot on success
- Returns 400 with specific error on validation failure

** COMPLETED**

### US-8.6: Undo purchase endpoint
**As a** developer, **I want** `DELETE /api/draft-sessions/:id/purchases/:purchaseId` to undo a purchase.

**Acceptance criteria:**
- Reverses all state effects of the purchase
- Returns updated draft snapshot
- Returns 404 if purchase not found

### US-8.7: Edit purchase endpoint
**As a** developer, **I want** `PUT /api/draft-sessions/:id/purchases/:purchaseId` to edit a purchase.

**Acceptance criteria:**
- Accepts `{price?, teamId?}`
- Validates new values
- Adjusts budgets and rosters accordingly
- Returns updated draft snapshot

### US-8.8: List user's draft sessions endpoint
**As a** developer, **I want** `GET /api/draft-sessions` to return all sessions for the authenticated user.

**Acceptance criteria:**
- Returns array of `{draftSessionId, name, status, createdAt, numberOfTeams}`
- Sorted by `createdAt` descending
- Requires authentication

### US-8.9: Valuations proxy endpoint
**As a** drafter, **I want** `GET /draft-sessions/:draftSessionId/valuations` to return per-player projected values for the active draft, **so that** the draft room can render the "$ Value" column without the client knowing the Player Data API exists.

> Implementation already exposes the route per `CLAUDE.md` (line 63). This story formalizes its contract.

**Acceptance criteria:**
- Server-side, builds `{ leagueSettings, draftState }` via `toPlayerApiLeagueSettings(session)` and `toPlayerApiDraftState(session)` (US-11.6) and POSTs to `POST /api/v1/players/valuations` on the Player Data API
- Returns `{ success: true, valuations: [{ playerId, projectedValue, purchasePrice, valueGap, rank }], dataAsOf, staleWarnings }`
- Requires authentication; only the session owner may call it
- Returns `503` (not `500`) if `PLAYER_API_URL` is set and the upstream is unreachable, with `{ success: false, errorMessage: "Player Data API unavailable" }`
- Returns `200` with `valuations: []` and a meta note (not an error) if upstream returns "no stats yet" (per Player Data API US-5.4 fallback)
- Errors from upstream are translated per US-11.8 (preserves status code, includes `errorCode` and `fieldErrors`)
- Used by US-13.1 client-side after each purchase

---

## Epic 9: Client State Architecture

### US-9.1: Create DraftContext for client-side draft state
**As a** developer, **I want** a React context that holds the active draft session state, **so that** all views read from a single source of truth.

**Acceptance criteria:**
- `DraftContext` provides: `session`, `teams`, `availablePlayers`, `purchasedPlayers`, `draftHistory`, `myTeamId`
- Provides actions: `loadSession`, `recordPurchase`, `undoPurchase`, `editPurchase`, `setMyTeam`
- Actions call API endpoints and update local state on success
- All draft views consume this context

### US-9.2: Refactor DraftRoomScreen to consume DraftContext
**As a** developer, **I want** `DraftRoomScreen` refactored to read from `DraftContext`, **so that** UI logic is separated from business logic.

**Acceptance criteria:**
- `DraftRoomScreen` no longer holds purchase state directly
- All data comes from `DraftContext`
- Form submissions call context actions
- Component re-renders when context state changes

### US-9.3: Home screen shows draft sessions list
**As a** drafter, **I want** the home screen to list my draft sessions, **so that** I can resume a draft or start a new one.

**Acceptance criteria:**
- Home screen fetches `GET /api/draft-sessions`
- Shows each session with name, status badge, team count, date
- Click navigates to draft room or setup depending on status
- "Create New Draft" button starts US-1.1 flow

---

## Epic 10: Polish & UX (Milestone 2)

### US-10.1: Draft session status indicator
**Acceptance criteria:**
- Status badge displayed in draft room header
- Color-coded: Setup=blue, Active=green, Paused=yellow, Completed=gray

### US-10.2: Confirmation dialog for destructive actions
**Acceptance criteria:**
- Undo triggers "Are you sure you want to undo [Player] to [Team] for $[Price]?"
- Confirm/Cancel buttons
- No state change on Cancel

### US-10.3: Success/error toast notifications
**Acceptance criteria:**
- Green toast for success ("Juan Soto purchased by Team 3 for $47")
- Red toast for errors ("Insufficient budget for this purchase")
- Toasts auto-dismiss after 4 seconds

### US-10.4: Keyboard shortcut for quick purchase recording
**Acceptance criteria:**
- Enter key in price field triggers "Record Purchase" if form is valid
- Focus management: after recording, focus returns to player search field

### US-10.5: Responsive layout for the draft room
**Acceptance criteria:**
- Sidebar collapses or becomes a bottom bar on narrow screens
- Tables horizontally scroll on narrow screens
- Core actions remain accessible at all breakpoints

---

## Epic 11: API Integration Readiness (Milestone 3)

> This epic wires the Draft Kit to the Player Data API's valuation, recommendation, and player-pool endpoints. The canonical request/response contracts are owned by the Player Data API (see US-5.3, US-5.4, US-5.5 and US-6.1–6.4 in `PLAYER_DATA_API_USER_STORIES.md`). This epic is mostly client plumbing plus one serializer.

### US-11.1: Document the cross-repo `{leagueSettings, draftState}` contract
**As a** developer maintaining both repos, **I want** a single authoritative description of the payload the Draft Kit sends to the Player Data API, **so that** breaking changes are caught at code-review time.

**Acceptance criteria:**
- A shared contract doc (in this repo's `docs/` or `README`) reproduces the shapes from Player Data API US-5.3 and US-5.4
- Documents the explicit mapping from the Draft Kit's `DraftSession.leagueSettings` (`numberOfTeams`, `salaryCap`, `rosterSlots` map, `scoringType`, `draftType`) to the engine fields
- Documents that `draftState.purchasedPlayers` is built from `DraftSession.draftHistory[]` + `teams[].purchasedPlayers[]`, and that `teamBudgets` and `filledRosterSlots` come from `teams[]`
- Lists the exact endpoints the Draft Kit will call: `/api/v1/players/pool`, `/api/v1/players/:playerId`, `/api/v1/players/valuations`, `/api/v1/players/recommendations`, `/api/v1/players/recommendations/nominations`, `/api/v1/usage`

### US-11.2: Add value column placeholder to player table
**Acceptance criteria:**
- "$ Value" column exists in available players table showing "--"
- Column header has a tooltip explaining it will show model-derived values once US-13.1 is wired
- Column renders the API's `projectedValue` when present, falls back to `--` otherwise

### US-11.3: Draft state export for API consumption
**Acceptance criteria:**
- `exportDraftState(sessionId)` returns a clean JSON payload matching the Player Data API contract from US-11.1:
  - `availablePlayerIds: string[]`
  - `purchasedPlayers: [{ playerId, teamId, price, positionFilled }]`
  - `teamBudgets: { [teamId]: number }`
  - `filledRosterSlots: { [teamId]: { [position]: number } }`
- No Mongoose internals or `_id` fields leak into the payload
- Player IDs use the `mlb-{id}` format; team IDs use `fantasy-team-{n}`
- Accompanied by `exportLeagueSettings(sessionId)` that returns the raw `leagueSettings` shape (the Player Data API handles normalization per US-5.3)

### US-11.4: Expand the licensed API client
**As a** developer, **I want** `server/lib/licensed-player-api.js` to expose every endpoint this repo needs, **so that** the Draft Kit controllers don't hand-roll fetches.

**Acceptance criteria:**
- Adds `getPlayerPool({ positions? })` → `GET /api/v1/players/pool`
- Adds `getPlayerById(playerId)` → `GET /api/v1/players/:playerId`
- Adds `postValuations({ leagueSettings, draftState })` → `POST /api/v1/players/valuations`
- Adds `postRecommendations({ leagueSettings, draftState, teamId })` → `POST /api/v1/players/recommendations`
- Adds `postNominations({ leagueSettings, draftState, teamId })` → `POST /api/v1/players/recommendations/nominations`
- Existing `getPlayers` and `postUsage` remain but point at `/api/v1/*` (see US-11.5)
- Each method propagates the Player Data API error shape through the translation in US-11.8
- Unit tests mock `fetch` and assert each method builds the correct URL, headers (`X-API-Key`, `Authorization: Bearer`), and body

### US-11.5: Migrate licensed API client to `/api/v1/*`
**As a** developer, **I want** the Draft Kit to hit the versioned Player Data API surface, **so that** legacy-route deprecation in the Player Data API (US-2.8 there) doesn't break us.

**Acceptance criteria:**
- All calls from `server/lib/licensed-player-api.js` go to `/api/v1/*`
- Optional `PLAYER_API_LEGACY=1` env flag falls back to unversioned routes for local testing against older API builds
- Health of the configured base URL is logged once on server startup (versioned path reachable, yes/no)
- README (`416-Minimum-Viable-Product/README.md`) updates its "Licensed Player Data API" examples to the versioned paths

### US-11.6: League-settings serializer for Player Data API calls
**As a** developer, **I want** a single helper that turns `DraftSession.leagueSettings` into whatever shape the Player Data API currently expects, **so that** future contract tweaks happen in one place.

**Acceptance criteria:**
- `server/lib/player-api-adapter.js` exports `toPlayerApiLeagueSettings(session.leagueSettings)` and `toPlayerApiDraftState(session)`
- Output matches the contract documented in US-11.1 / US-5.3 / US-5.4
- `toPlayerApiDraftState` handles edge cases: no purchases yet, `teams` with missing `filledRosterSlots`, paused/completed sessions
- Unit tested with a representative session fixture

### US-11.7: Surface Player Data API data-freshness in the draft room
**As a** drafter, **I want** to see when the upstream player data was last refreshed, **so that** I know whether injury flags are current.

**Acceptance criteria:**
- When the draft kit calls `/api/v1/players/pool` or `/api/v1/players/valuations`, it forwards the response's `dataAsOf` and `staleWarnings` to the client
- Draft room header renders a small "Player data as of X ago" line
- If `staleWarnings` is non-empty, render a yellow badge and list the stale sources on hover

### US-11.8: Translate Player Data API errors to the Draft Kit error shape
**As a** client developer, **I want** error shapes from the Player Data API to be translated into the Draft Kit's `{ success, errorMessage }` shape on the server side, **so that** the client only has to handle one error convention.

**Acceptance criteria:**
- `server/lib/licensed-player-api.js` detects the Player Data API's `{ success: false, error, code, fields? }` shape and throws a typed error including `code` and field-level `fields[]`
- The Draft Kit controllers calling these methods translate that into `{ success: false, errorMessage, errorCode, fieldErrors }` in their JSON responses (extending the existing shape, not breaking it)
- `400` responses from the Player Data API surface as `400` from the Draft Kit (not swallowed as `500`)
- The client can read `fieldErrors` to show inline validation messages on the purchase / valuation forms

---

## Epic 12: External Data Integration (Milestone 4)

> **Rewrite note (was ingestion, now consumption):** The Player Data API owns MLB Stats API ingestion (its Epic 4). This epic used to describe the Draft Kit doing its own sync; that duplicated work. These stories now describe the Draft Kit **consuming** what the Player Data API already produces. If/when a local cache is ever desired, it is additive — the pull-through flow is the baseline.

### US-12.1: Hydrate player details from the Player Data API pool
**As a** drafter, **I want** the draft room's player list to carry full metadata (name, positions, team, status, depth-chart info), **so that** I can judge playing time before bidding.

**Acceptance criteria:**
- On draft start (US-3.2) and on each `GET /api/draft-sessions/:id/players` call, the Draft Kit server retrieves player records from `GET /api/v1/players/pool` via the US-11.4 client
- Records are passed through to the client in `PlayerStub` shape plus `depthChartRank`, `depthChartPosition`, and `dataAsOf`
- A manual "Refresh player data" button in the draft room re-fetches the pool and updates displayed rows in place
- No local `PlayerStub` collection is required; if caching is added later, it is behind a feature flag

### US-12.2: Display injury status from Player Data API
**As a** drafter, **I want** to see each player's injury status (e.g. `IL-10`, `IL-60`, `DTD`, `active`), **so that** I can avoid bidding on unavailable players.

**Acceptance criteria:**
- `status` field from the Player Data API's `PlayerStub` is displayed as a badge next to the player name
- Status colors: red for `IL-*`, yellow for `DTD`, gray for `minors`/`DFA`, none for `active`
- No polling from the Draft Kit — the Player Data API's refresh cadence (every 15–60 min per its US-4.2) is the source of truth
- Sort by `status` available on the Players tab

### US-12.3: Display depth-chart / roster status from Player Data API
**As a** drafter, **I want** to see whether a player is a starter, backup, or in the minors, **so that** I can assess playing time quickly.

**Acceptance criteria:**
- `depthChartRank` and `depthChartPosition` from the Player Data API response are rendered as a badge or column in the player table (e.g. "SP1", "OF-bench", "AAA")
- Filter "Show only starters" toggles `depthChartRank === 1`
- When a player is sent down or recalled between refreshes, the next pool refresh picks up the change with no Draft Kit code change

---

## Epic 13: Valuation & Recommendation Engine (Milestone 5)

> Depends on Player Data API Epics 5 and 6, and Draft Kit Epic 11 (specifically US-11.4 for the client methods and US-11.6 for the serializers).

### US-13.1: Request live valuations from the Player Data API
**Acceptance criteria:**
- After each recorded purchase (and on draft-room load), the Draft Kit server calls `postValuations({ leagueSettings, draftState })` via US-11.4
- `leagueSettings` is the session's raw leagueSettings (the Player Data API handles normalization per its US-5.3)
- `draftState` is built by `toPlayerApiDraftState(session)` from US-11.6 (includes `availablePlayerIds`, `purchasedPlayers`, `teamBudgets`, `filledRosterSlots`)
- Response populates the "$ Value" column for available players via `DraftContext`
- Values change as the draft progresses (verified by eyeballing the column mid-draft)
- If the Player Data API returns `valuations: []` with a "no stats" meta, the UI shows the placeholder `--` (no crash)

### US-13.2: Display recommendation tier for available players
**Acceptance criteria:**
- Recommendation column in the player table renders the `tier` value returned by the Player Data API (per its US-6.1)
- **Color mapping is rendered from the API `tier` field only** — the Draft Kit does not compute thresholds locally:
  - `"buy"` → green
  - `"fair"` → yellow
  - `"avoid"` → red
- Hovering the badge shows the API's `reason` string
- Column is hidden while `recommendations` is empty / loading

### US-13.3: Show value-over-replacement ("Surplus") for remaining players
**Acceptance criteria:**
- "Surplus" column renders the `valueGap` field from the Player Data API (per its US-5.5)
- For available players (no `purchasePrice`), `valueGap` is `null` → column shows `--`
- For purchased players, `valueGap = projectedValue − purchasePrice`
- Positive surplus highlighted in green, negative in red
- Sortable, so best values float to top
- Draft Kit does **not** recompute surplus locally

### US-13.4: Position scarcity alerts
**Acceptance criteria:**
- The Draft Kit pulls position-scarcity metadata from the Player Data API's `/players/recommendations` response (threshold + position list)
- Thresholds and triggering logic live in the API response metadata — not hardcoded in the Draft Kit client
- Alert appears in the sidebar and optionally as a toast when a position moves into the scarce state
- Alert includes the API-supplied `reason` string so the copy stays consistent with the recommendation engine

---

## Epic 14: End-to-End Validation (Milestone 5)

> Both repos are now implemented enough to talk to each other for the pool flow (US-3.2, US-3.3). These stories close the loop with executable proof that the two halves work together.

### US-14.1: Two-server local boot script
**As a** developer, **I want** a single command that boots both the Player Data API and the Draft Kit server with a known-good `PLAYER_API_URL`, `PLAYER_API_KEY`, and Mongo URI, **so that** any contributor can reproduce a draft end-to-end without reading two READMEs.

**Acceptance criteria:**
- `docs/dev-setup.md` (or root `README`) documents the exact env vars on each side
- A script (e.g. `npm run dev:full` at the project root, or a documented two-terminal recipe) brings up both servers
- Health check: hitting `GET /api/v1/health` on the API and `GET /draft-sessions/<id>` on the Draft Kit both return 200 against the same Mongo + same API key

### US-14.2: End-to-end smoke test
**As a** developer, **I want** an automated smoke test that exercises the full happy path against a real (in-process or containerized) Player Data API, **so that** cross-repo contract drift is caught before merge.

**Acceptance criteria:**
- Test boots a Player Data API instance (in-memory DB + seed) and points the Draft Kit at it
- Test scenario, in order: register user → create league → POST `/draft-sessions` → PUT settings → POST `/draft-sessions/:id/start` (US-8.4) → GET `/draft-sessions/:id/players?status=available` (US-3.3) → POST a purchase (US-8.5) → DELETE the purchase (US-8.6) → assert `availablePlayerIds.length` and `sum(team budgets) + sum(prices)` invariants hold
- Test fails loudly if upstream pool shape changes (e.g. `playerId` field renamed)
- Runs in CI; gated behind `RUN_E2E=1` locally so default `npm test` stays fast

### US-14.3: Contract drift guard
**As a** developer, **I want** `toPlayerApiLeagueSettings` and `toPlayerApiDraftState` (US-11.6) covered by a contract test that loads a fixture from the Player Data API repo's documented schema, **so that** if the API changes the request shape, the Draft Kit's serializer test fails — not a live draft.

**Acceptance criteria:**
- Fixture file checked into both repos (or pulled from a single shared location) with a representative `{ leagueSettings, draftState }` payload
- Test asserts the serializer output matches the fixture schema exactly (no extra/missing top-level keys)
- Documented update procedure: when the Player Data API revs the shape, both repos update the fixture in lockstep

---

## Domain Model Reference

### DraftSession
```
draftSessionId, name, createdAt, leagueSettings, teams[], draftHistory[],
availablePlayerIds[], purchasedPlayerIds[], status
```

### LeagueSettings
```
numberOfTeams, salaryCap, draftType = AUCTION, rosterSlots, scoringType, eligiblePositions
```

### FantasyTeam
```
teamId, teamName, budgetRemaining, purchasedPlayers[], filledRosterSlots
```

### DraftPurchase
```
purchaseId, playerId, teamId, price, timestamp, nominationOrder
```

### PlayerStub (pass-through shape from Player Data API)
```
playerId (mlb-{id}), name, positions[], mlbTeam, status, isAvailable,
depthChartRank?, depthChartPosition?, dataAsOf?
```
> No local `PlayerStub` collection is required. The Draft Kit treats this as the shape in flight from the Player Data API's `/api/v1/players/pool` response.

### ID Conventions
- Player ID: `mlb-{mlbPersonId}` (e.g. `mlb-592450`)
- MLB Team ID: `mlb-{mlbTeamId}`
- Fantasy Team ID: `fantasy-team-{n}` (e.g. `fantasy-team-3`)

---

## Cross-Repo Contract (for Epics 11 and 13)

Authoritative definitions live in the Player Data API's US-5.3 / US-5.4 / US-5.5. Reproduced here for quick reference.

```ts
// Outgoing request body for valuations, recommendations, nominations
{
  leagueSettings: {
    numberOfTeams: number,
    salaryCap: number,
    rosterSlots: { [position: string]: number },  // full map, Draft Kit shape
    scoringType: "5x5 Roto" | "H2H Categories" | "Points",
    draftType: "AUCTION"
  },
  draftState: {
    availablePlayerIds: string[],                  // "mlb-..."
    purchasedPlayers: Array<{ playerId, teamId, price, positionFilled? }>,
    teamBudgets:       Record<string, number>,     // teamId -> $ remaining
    filledRosterSlots: Record<string, Record<string, number>>
  },
  teamId?: string                                  // "fantasy-team-3"
}
```

---

## Story Count Summary

| Milestone | Epics | Stories |
|-----------|-------|---------|
| M1: Realign & Build | 0, 1, 2, 3, 4, 5, 6, 8, 9 | 50 (US-2.4 superseded; US-8.9 added) |
| M2: Validate & Polish | 7, 10 | 10 |
| M3: API Integration Readiness | 11 | 8 |
| M4: External Data (consumer) | 12 | 3 |
| M5: Valuation Engine | 13 | 4 |
| M5: End-to-End Validation | 14 | 3 |
| **Total** | | **78** |
