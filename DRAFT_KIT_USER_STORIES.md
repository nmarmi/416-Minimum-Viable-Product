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
- US-2.1, US-2.2, US-2.3, US-2.4
- Depends on: Phase 1 (clean codebase)

### Phase 3: Seed Data (consume from Player Data API)
- US-3.2, US-3.3
- Depends on: Phase 2 (PlayerStub schema exists)
- Note: The seed dataset itself is created in the Player Data API repo. This repo imports it.

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
- US-11.1, US-11.2, US-11.3
- Depends on: Player Data API placeholder endpoints (US-2.4, 2.5 in that repo)

### Phase 15: External Data Integration (Milestone 4)
- US-12.1, US-12.2, US-12.3
- Depends on: Player Data API ingestion jobs (Epic 4 in that repo)

### Phase 16: Valuation & Recommendations (Milestone 5)
- US-13.1, US-13.2, US-13.3, US-13.4
- Depends on: Player Data API valuation engine (Epics 5–6 in that repo)

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

### US-0.3: Remove league invite/join flow
**As a** drafter, **I want** the invite-code join flow removed, **so that** the app is not pretending to be a multi-user league platform.

**Acceptance criteria:**
- `PlayerHomeScreen` join-by-code form is removed
- Server `POST /leagues/join` endpoint is deprecated or removed
- "My Leagues" list is replaced with "My Draft Sessions" or equivalent
- League `inviteCode` field is no longer required for draft sessions

### US-0.4: Remove season/standings/schedule concepts
**As a** drafter, **I want** all references to seasons, standings, and schedules removed, **so that** the product clearly focuses on the draft.

**Acceptance criteria:**
- `League` model fields `seasonYear`, `isActive`, `leagueMode` are removed or ignored
- No UI references to "season", "standings", or "schedule"
- No concept of an ongoing season after the draft

### US-0.5: Clean up unused server dependencies
**As a** developer, **I want** unused packages (`sequelize`, `pg`, `pg-hstore`, duplicate `bcrypt`/`bcryptjs`) removed from `server/package.json`, **so that** the dependency tree reflects actual usage.

**Acceptance criteria:**
- `sequelize`, `pg`, `pg-hstore` removed from `package.json`
- Only one of `bcrypt` / `bcryptjs` remains (whichever controllers actually use)
- `npm install` succeeds with no extraneous packages

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

### US-1.2: Configure number of teams
**As a** drafter, **I want** to specify how many teams are in my league (e.g. 10, 12, 14), **so that** budgets and roster math are correct.

**Acceptance criteria:**
- Numeric input for `numberOfTeams` (min 2, max 30)
- Value persists in `LeagueSettings` within the draft session
- Changing the number regenerates the `teams[]` array to match

### US-1.3: Configure salary cap
**As a** drafter, **I want** to set the salary cap per team (e.g. $260), **so that** budget tracking is accurate.

**Acceptance criteria:**
- Numeric input for `salaryCap` (min 1)
- Value persists in `LeagueSettings`
- Each team's `budgetRemaining` initializes to this value

### US-1.4: Configure roster slots
**As a** drafter, **I want** to define roster slot counts by position (C, 1B, 2B, 3B, SS, OF, UTIL, SP, RP, BENCH), **so that** the app can track filled vs. open slots.

**Acceptance criteria:**
- UI shows each position with a numeric input for slot count
- Values persist in `LeagueSettings.rosterSlots`
- Total roster size is computed and displayed
- Default values are provided (e.g. standard 23-slot roster)

### US-1.5: Set scoring type placeholder
**As a** drafter, **I want** to select a scoring type label (e.g. "5x5 Roto", "H2H Categories", "Points"), **so that** the session records my league format for later use.

**Acceptance criteria:**
- Dropdown or radio with common scoring type options
- Value persists in `LeagueSettings.scoringType`
- This is informational only for now (no scoring calculations)

### US-1.6: Draft type defaults to auction
**As a** drafter, **I want** the draft type to default to "AUCTION" and be displayed but not editable (for now), **so that** the entire app is oriented around auction drafts.

**Acceptance criteria:**
- `LeagueSettings.draftType` is set to `"AUCTION"`
- Displayed as read-only in settings UI
- No snake/linear draft option exists

### US-1.7: Name fantasy teams
**As a** drafter, **I want** to assign names to each fantasy team, **so that** I can identify who is purchasing players during the draft.

**Acceptance criteria:**
- For each team (based on `numberOfTeams`), a text input for team name
- Default names are `fantasy-team-1`, `fantasy-team-2`, etc.
- User can rename any team (e.g. "Eric's Team", "Table 3 Guy")
- Each team gets a `teamId` in the format `fantasy-team-{n}`

### US-1.8: Initialize draft session
**As a** drafter, **I want** to finalize setup and start the draft, **so that** the session transitions from setup to active.

**Acceptance criteria:**
- A "Start Draft" button validates settings are complete (teams > 0, cap > 0, at least one roster slot)
- `DraftSession.status` transitions from `"setup"` to `"active"`
- All teams are initialized with `budgetRemaining = salaryCap`, empty `purchasedPlayers[]`, and zeroed `filledRosterSlots`
- `availablePlayerIds[]` is populated from the player pool
- User is taken to the active draft view

---

## Epic 2: Domain Model & Draft State Service

### US-2.1: Create DraftSession server model
**As a** developer, **I want** a `DraftSession` Mongoose model, **so that** draft state is persisted.

**Acceptance criteria:**
- Schema includes: `draftSessionId`, `name`, `createdAt`, `leagueSettings` (embedded), `teams[]` (embedded), `draftHistory[]` (embedded), `availablePlayerIds[]`, `purchasedPlayerIds[]`, `status` (enum: setup, active, paused, completed)
- Model is exported and registered with Mongoose

### US-2.2: Create FantasyTeam embedded schema
**As a** developer, **I want** a `FantasyTeam` sub-schema, **so that** each team's budget and roster are tracked within the draft session.

**Acceptance criteria:**
- Fields: `teamId`, `teamName`, `budgetRemaining`, `purchasedPlayers[]` (array of `{playerId, price}`), `filledRosterSlots` (map of position to count)
- Embedded within `DraftSession.teams[]`

### US-2.3: Create DraftPurchase embedded schema
**As a** developer, **I want** a `DraftPurchase` sub-schema, **so that** each purchase is recorded in ordered history.

**Acceptance criteria:**
- Fields: `purchaseId`, `playerId`, `playerName`, `teamId`, `price`, `timestamp`, `nominationOrder`
- Embedded within `DraftSession.draftHistory[]`
- `nominationOrder` auto-increments per session

### US-2.4: Create PlayerStub model (local cache of Player Data API)
**As a** developer, **I want** a `PlayerStub` model for the local player pool, **so that** the draft can function with locally cached player data.

**Acceptance criteria:**
- Fields: `playerId` (format: `mlb-{id}`), `name`, `positions[]`, `mlbTeam`, `status` (active/injured/minors), `isAvailable` (default true)
- Schema matches the `PlayerStub` shape defined by the Player Data API
- Indexed on `playerId` (unique)
- Note: The canonical player data lives in the Player Data API. This is a local working copy.

### US-2.5: Implement draft state service — initialize draft
**As a** developer, **I want** a server-side draft state service that initializes a draft, **so that** business logic is separated from route handlers.

**Acceptance criteria:**
- `initializeDraft(sessionId)` sets all teams' budgets, marks all players available, sets status to active
- Returns the initialized draft snapshot
- Validation: fails if session is already active

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

### US-2.8: Implement draft state service — edit purchase
**As a** developer, **I want** the draft state service to edit a purchase (change price or team), **so that** recording errors can be fixed without full undo.

**Acceptance criteria:**
- `editPurchase(sessionId, purchaseId, {newPrice?, newTeamId?})` performs:
  - If price changed: adjusts old team's budget (refund old, deduct new)
  - If team changed: moves player between teams, adjusts both budgets
  - Updates `draftHistory[]` entry
  - Validates new values (budget sufficient, etc.)
- Returns updated draft snapshot

### US-2.9: Implement draft state service — get snapshot
**As a** developer, **I want** a function that returns the current draft snapshot, **so that** views can render the latest state.

**Acceptance criteria:**
- `getDraftSnapshot(sessionId)` returns:
  - List of available players with basic info
  - List of purchased players with price and team
  - Each team's remaining budget, purchased players, filled slots
  - Ordered draft history
  - Session status

---

## Epic 3: Player Pool — Seed Data Integration

> Note: US-3.1 (create seed dataset) has been removed. The seed dataset is owned by the Player Data API repo (their US-1.4). This repo consumes it.

### US-3.2: Import seed data into PlayerStub collection
**As a** developer, **I want** a script to load seed player data into the database, **so that** draft sessions have a player pool.

**Acceptance criteria:**
- Script reads the seed file (sourced from Player Data API repo's seed dataset) and upserts into `PlayerStub` collection
- Running the script is idempotent (re-run doesn't create duplicates)
- Script logs count of imported players

### US-3.3: API endpoint to list available players
**As a** drafter, **I want** an API endpoint that returns the player pool for a draft session, **so that** the UI can display available players.

**Acceptance criteria:**
- `GET /api/draft-sessions/:sessionId/players?status=available` returns available players
- Supports optional `search`, `position`, `team` query filters
- Returns `playerId`, `name`, `positions`, `mlbTeam`, `status`, `isAvailable`
- Pagination via `limit` and `offset`

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

### US-4.2: Player autocomplete filters to available players only
**As a** drafter, **I want** the player search in the purchase form to only show available (unpurchased) players, **so that** I cannot accidentally re-select a purchased player.

**Acceptance criteria:**
- Autocomplete queries only players where `isAvailable === true`
- Previously purchased players do not appear in suggestions
- If the user types a purchased player's name, no results appear

### US-4.3: Team dropdown reflects session teams
**As a** drafter, **I want** the team dropdown in the purchase form to list the actual teams from my draft session, **so that** I select the correct buyer.

**Acceptance criteria:**
- Dropdown is populated from `DraftSession.teams[]`
- Shows team name and remaining budget (e.g. "Eric's Team ($238)")
- Updates after each purchase to show current budget

### US-4.4: Price validation on purchase
**As a** drafter, **I want** the app to validate that the purchase price does not exceed the team's remaining budget (accounting for $1 minimums for remaining roster slots), **so that** invalid purchases are prevented.

**Acceptance criteria:**
- Maximum allowed bid = `budgetRemaining - (openRosterSlots - 1)` (every unfilled slot needs at least $1)
- If entered price exceeds max bid, show inline validation error
- Price must be >= $1
- Price must be a whole number

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

### US-5.2: Undo any purchase from draft history
**As a** drafter, **I want** to undo any specific purchase from the draft history log, **so that** I can correct errors found later.

**Acceptance criteria:**
- Each row in the draft history table has an "Undo" action
- Clicking it calls the undo API for that specific `purchaseId`
- All state effects are reversed (availability, budget, roster)
- The history list re-renders without that entry
- Confirmation prompt before undo ("Are you sure?")

### US-5.3: Edit a purchase price
**As a** drafter, **I want** to edit the price of a recorded purchase, **so that** I can fix a typo without undoing and re-entering.

**Acceptance criteria:**
- Each row in draft history has an "Edit" action
- Clicking it opens an inline or modal editor for price (and optionally team)
- On save, calls the edit purchase API
- Budgets adjust (old team gets refund of difference, or new team is charged)
- Validation applies (new price must be affordable)

### US-5.4: Edit the purchasing team of a purchase
**As a** drafter, **I want** to change which team a purchase is assigned to, **so that** I can fix a team-selection error.

**Acceptance criteria:**
- The edit modal/inline allows changing the team dropdown
- On save: old team's budget is restored, new team's budget is charged
- Player moves from old team's roster to new team's roster
- Validation: new team must have sufficient budget and open roster slots

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

### US-6.2: Purchased players view
**As a** drafter, **I want** to see all purchased players with their buyer and price, **so that** I can track what has been drafted.

**Acceptance criteria:**
- A "Purchased" view/tab shows all purchased players
- Columns: Player Name, Positions, Team That Bought, Price
- Sortable by price, team, or order of purchase
- Count of purchased players displayed

### US-6.3: Team budgets view
**As a** drafter, **I want** to see every team's remaining budget, roster slots filled, and max bid, **so that** I can gauge the competitive landscape.

**Acceptance criteria:**
- Teams tab shows all fantasy teams in the session
- For each team: name, budget remaining, budget spent, roster slots filled / total, max possible bid
- Max bid = `budgetRemaining - (openSlots - 1)`
- Updates in real time after each purchase

### US-6.4: Draft history view
**As a** drafter, **I want** to see the ordered log of all purchases, **so that** I can review what happened in the draft.

**Acceptance criteria:**
- Draft Board tab shows a table of all purchases in chronological order
- Columns: #, Player Name, Team, Price, Timestamp
- Most recent purchase is at the top
- Each row has Undo and Edit actions (from Epic 5)
- Empty state: "No picks recorded yet"

### US-6.5: My team view / roster
**As a** drafter, **I want** to designate one team as "my team" and see my roster and budget prominently, **so that** I can focus on my own draft strategy.

**Acceptance criteria:**
- User can mark one team as "My Team" (persisted in session or locally)
- Sidebar budget tracker shows "My Team" budget, max bid, avg $/remaining slot
- "My Roster" tab shows my purchased players by position slot
- Filled vs. open slots are clearly indicated

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

### US-8.2: Get draft session endpoint
**As a** developer, **I want** `GET /api/draft-sessions/:id` to return the full draft snapshot.

**Acceptance criteria:**
- Returns full `DraftSession` including teams, history, available/purchased counts
- Requires authentication
- Returns 404 if not found

### US-8.3: Update draft settings endpoint
**As a** developer, **I want** `PUT /api/draft-sessions/:id/settings` to update league settings.

**Acceptance criteria:**
- Accepts `{numberOfTeams, salaryCap, rosterSlots, scoringType, teams}`
- Only allowed when `status === "setup"`
- Returns updated session

### US-8.4: Start draft endpoint
**As a** developer, **I want** `POST /api/draft-sessions/:id/start` to initialize and activate the draft.

**Acceptance criteria:**
- Validates all settings are complete
- Initializes team budgets and player pool
- Sets `status` to `"active"`
- Returns initialized draft snapshot

### US-8.5: Record purchase endpoint
**As a** developer, **I want** `POST /api/draft-sessions/:id/purchases` to record a purchase.

**Acceptance criteria:**
- Accepts `{playerId, teamId, price}`
- Runs full validation (availability, budget, roster)
- Returns updated draft snapshot on success
- Returns 400 with specific error on validation failure

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

### US-11.1: Define player valuation request contract
**Acceptance criteria:**
- Documented request shape: `{draftState: {availablePlayers, purchasedPlayers, teamBudgets, rosterSlots}, playerId?}`
- Documented response shape: `{playerId, estimatedValue, recommendationTier}`
- Contract lives in `README` or a shared types file

### US-11.2: Add value column placeholder to player table
**Acceptance criteria:**
- "$ Value" column exists in available players table showing "--"
- Column header has a tooltip explaining it will show model-derived values

### US-11.3: Draft state export for API consumption
**Acceptance criteria:**
- `exportDraftState(sessionId)` returns a clean JSON payload with: available player IDs, purchased player IDs with prices and teams, all team budgets, roster slot configuration
- No Mongoose internals or `_id` fields leak into the payload
- Player IDs use the `mlb-{id}` format

---

## Epic 12: External Data Integration (Milestone 4)

### US-12.1: Sync player metadata from external source
**Acceptance criteria:**
- Script fetches normalized player data from the Player Data API
- Upserts into `PlayerStub` collection
- Logs new/updated/unchanged counts
- Can be run manually or on schedule

### US-12.2: Sync injury status
**Acceptance criteria:**
- Injury status field on `PlayerStub` (e.g. "10-day IL", "60-day IL", "DTD", "healthy")
- Injury badge displayed next to player name in the table
- Refresh interval: every 6-12 hours, with manual refresh button

### US-12.3: Sync depth chart / roster status
**Acceptance criteria:**
- `PlayerStub.status` updated from external data (starter, bench, minors, DFA)
- Displayed as a badge or column in the player table
- Filterable (e.g. "Show only starters")

---

## Epic 13: Valuation & Recommendation Engine (Milestone 5)

### US-13.1: Request live valuations from Player Data API
**Acceptance criteria:**
- After each purchase, the app can (optionally) request updated values
- Response populates the "$ Value" column for available players
- Values change as the draft progresses

### US-13.2: Display recommendation tier for available players
**Acceptance criteria:**
- Recommendation column in player table
- Values come from the Player Data API based on current draft state
- Color-coded: green (buy), yellow (fair), red (avoid)

### US-13.3: Show value-over-replacement for remaining players
**Acceptance criteria:**
- "Surplus" column shows `estimatedValue - projectedCost`
- Positive surplus highlighted in green
- Sortable, so best values float to top

### US-13.4: Position scarcity alerts
**Acceptance criteria:**
- System tracks remaining available players per position
- Alert shown when a position drops below a threshold
- Alert appears in sidebar and optionally as a toast

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

### PlayerStub (local cache)
```
playerId (mlb-{id}), name, positions[], mlbTeam, status, isAvailable
```

### ID Conventions
- Player ID: `mlb-{mlbPersonId}` (e.g. `mlb-592450`)
- MLB Team ID: `mlb-{mlbTeamId}`
- Fantasy Team ID: `fantasy-team-{n}` (e.g. `fantasy-team-3`)

---

## Story Count Summary

| Milestone | Epics | Stories |
|-----------|-------|---------|
| M1: Realign & Build | 0, 1, 2, 3, 4, 5, 6, 8, 9 | 37 |
| M2: Validate & Polish | 7, 10 | 10 |
| M3: API Integration Readiness | 11 | 3 |
| M4: External Data | 12 | 3 |
| M5: Valuation Engine | 13 | 4 |
| **Total** | | **57** |
