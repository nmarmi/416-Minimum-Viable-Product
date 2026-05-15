# DraftIQ — Draft Kit User Stories & Execution Plan

## Implementation Status

**74 / 111 stories complete** (67%). Stories that are implemented in the codebase are marked `✅ COMPLETED` on their heading line.

| Epic | Status | Notes |
|---|---|---|
| Epic 0 — Product realignment (remove commissioner) | ✅ Done | League is now a single-owner draft container |
| Epic 1 — Draft session setup | ✅ Done | All 8 stories — teams, salary cap, slots, scoring, naming, init |
| Epic 2 — Domain model & draft state service | ✅ Done | DraftSession + FantasyTeam + DraftPurchase schemas; full CRUD service. US-2.4 superseded (no local PlayerStub cache; Player Data API is the source) |
| Epic 3 — Player pool from Player Data API | ✅ Done | Pool ID fetch + proxied player details endpoint |
| Epic 4 — Purchase recording (UI) | ✅ Done | Draft board entry, autocomplete, team dropdown, price validation |
| Epic 5 — Undo / Edit purchase | ✅ Done | Undo most recent + any historical, edit price + team |
| Epic 6 — Basic views | ✅ Done | Available, purchased, team budgets, history, my team, live sidebar |
| Epic 7 — State validation & integrity | ✅ Done | Duplicate prevention, budget overrun, roster overflow, status guards, tests |
| Epic 8 — API routes for draft operations | ✅ Done | All 9 endpoints — CRUD + start + purchases + valuations proxy |
| Epic 9 — Client state architecture | ⚠️ Partial | US-9.3 home screen done. US-9.1/9.2 (DraftContext) **superseded** — `GlobalStoreContext` (Flux-style reducer in `client/src/store/index.js`) holds the draft session instead of a dedicated DraftContext |
| Epic 10 — Polish & UX | ⚠️ Partial | US-10.2 (confirm dialogs), US-10.3 (toasts), US-10.5 (responsive) done. US-10.1 (status indicator) and US-10.4 (keyboard shortcut) **not done** |
| Epic 11 — API integration readiness | ✅ Done | All 8 stories — contract docs, value column, draft-state export, expanded SDK, /api/v1 migration, settings serializer, freshness, error mapping |
| Epic 12 — External data integration | ✅ Done | Hydration, injury display, depth chart |
| Epic 13 — Valuation & recommendation engine | ✅ Done | Live valuations, recommendation tiers, surplus, scarcity alerts |
| Epic 14 — End-to-end validation | ✅ Done | Two-server boot, smoke test, contract drift guard |
| Epic 15 — Year-aware drafts | ⏳ Pending | Season year, year filtering, clone from prior year |
| Epic 16 — Auth hardening | ⚠️ Partial | US-16.1 (document existing flow) done. US-16.2 (password reset) **not implemented** — `/forgot-password` is a UI shell with `event.preventDefault()` |
| Epic 17 — League configuration extensions | ⏳ Pending | AL/NL/MLB scope, custom stats, custom positions |
| Epic 18 — Pre-draft rosters & keepers | ⏳ Pending | Contract values, position moves, eligibility, team moves |
| Epic 19 — Minor league rosters | ⏳ Pending | Per-team minors, exclusion from auction, moves |
| Epic 20 — Player notes | ⏳ Pending | Pre-draft + during-draft notes, edit/delete |
| Epic 21 — Single-player details surface | ⏳ Pending | Stats, age, injury, depth, transactions |
| Epic 22 — Sorting & list operations | ⏳ Pending | Sort by $ / stats, position moves, redo |
| Epic 23 — Team comparison | ⏳ Pending | Side-by-side, sortable |
| Epic 24 — MLB depth chart view | ⏳ Pending | View MLB team depth |
| Epic 25 — Push notification consumption | ⏳ Pending | Receive pushed updates, toast feed |
| Epic 26 — Taxi draft | ⏳ Pending | Order, entry, eligibility removal, edits |

## Product Vision

The Draft Kit is an **auction draft assistant** for a single fantasy baseball drafter. It tracks the live auction state: player availability, team budgets, purchase history, and roster slots. It is NOT a league manager or commissioner platform.

## Relationship to Player Data API

The Player Data API repo owns player data, seed datasets, valuations, and recommendations. The Draft Kit consumes player data from that API. During early development before integration, the Draft Kit uses a local copy of the seed data produced by the Player Data API repo.

---

## Rubric Coverage

This section maps every line in the project rubric (`416-S26-Final Project-System Testing - Project Requirements.csv`) to the user story (existing or new) that satisfies it. Rubric items with no Draft Kit-side work are marked **(API)** and live in the Player Data API repo's user stories file.

### Draft Kit Accounts (10 pts)
| Rubric line | Pts | Story |
|---|---:|---|
| Account Creation & Login Mechanisms | 2 | US-16.1 |
| Account Password/Login Reset/Retrieval | 2 | US-16.2 |
| User can create draft for given year | 2 | US-15.1 |
| User can create multiple drafts | 2 | US-1.1, US-0.3 (1 league = 1 draft, multiple leagues per user) |
| User can access multiple drafts | 2 | US-9.3 |
| User can access drafts from current and past years | 2 | US-15.2 |
| Can create new draft using completed draft from previous year | 2 | US-15.3 |

### Draft Kit Prep (20 pts)
| Rubric line | Pts | Story |
|---|---:|---|
| Setup Draft using AL-only / NL-only / all MLB | 2 | US-17.1 |
| Custom number of Fantasy Teams | 2 | US-1.2 |
| Custom Fantasy Team names | 2 | US-1.7 |
| Custom Stats Selection for League | 2 | US-17.2 |
| Custom Hitter and Pitcher Positions for League | 2 | US-17.3 |
| Pre-draft rosters with Contract and $ values | 2 | US-18.1 |
| Move player to another position within team | 2 | US-18.2 |
| Position eligibility enforcement | 2 | US-18.3 |
| Enter minor league rosters | 2 | US-19.1 |
| Minor league players not eligible for draft | 2 | US-19.2 |
| Move minor league players between teams | 2 | US-19.3 |
| Enter Player Notes before/during draft | 1 | US-20.1 |
| Edit Player Notes before/during draft | 1 | US-20.2 |

### Draft Day (20 pts)
| Rubric line | Pts | Story |
|---|---:|---|
| Ordered Draft History with full detail | 2 | US-6.4 |
| Filtering Players List by Position | 2 | US-6.1 |
| Filtering/Searching Players List by Name | 2 | US-6.1 |
| Sorting Players List by $ | 2 | US-22.1 |
| Sorting Players List by Stats | 2 | US-22.2 |
| Move player to new position | 2 | US-22.3 |
| Any players moved between teams | 2 | US-18.4 (covers pre-draft + during-draft via US-5.4) |
| Player Details — Stats, Age, Injury, Depth, Transactions | 2 | US-21.1 |
| Fantasy Team Tabular Comparison | 2 | US-23.1 |
| Fantasy Team Comparison sortable by Rank/$ | 2 | US-23.2 |
| Can View MLB Team Depth Charts | 2 | US-24.1 |
| Undo/Redo for all draft Editing | 2 | Undo: US-5.1/5.2; Redo: US-22.4 |

### Player API → Draft Kit Push Notification (10 pts)
| Rubric line | Pts | Story |
|---|---:|---|
| Mechanism to Force New Notification-worthy info via Player API | 5 | **(API)** Epic 13 |
| Draft Kit show updated pushed state | 2 | US-25.1 |
| Draft Kit employs notification system to alert user | 2 | US-25.2 |
| Player Details — Depth Chart | 1 | US-21.1 |
| Player Details — Transactions/Contract | 1 | US-21.1 |
| Player Details — Injury/News | 1 | US-21.1 |

### Taxi Draft (10 pts)
| Rubric line | Pts | Story |
|---|---:|---|
| Taxi Draft Order can be specified | 1 | US-26.1 |
| Taxi Draft Order can be changed | 1 | US-26.2 |
| Players entered in Taxi Rosters in any order | 4 | US-26.3 |
| Players easily found for Taxi entry | 2 | US-26.4 |
| Players entered are removed from eligible list | 4 | US-26.5 |
| Taxi Draft Rosters can be edited | 2 | US-26.6 |

### Player API Licensing (10 pts) and Player API Valuations (10 pts)
Both fall under the Player Data API repo. See its `PLAYER_DATA_API_USER_STORIES.md#rubric-coverage` for the mapping.

### User Interface (10 pts)
Quality assessment — covered by Epic 10 (US-10.1 to 10.5) plus the layout/feedback/branding decisions in Epics 6, 9, and 21–25.

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

### US-0.1: Remove commissioner role and home screen ✅ COMPLETED
**As a** drafter, **I want** the app to stop presenting commissioner vs. player role selection, **so that** the experience is focused on a single drafter using the tool.

**Acceptance criteria:**
- `RegisterScreen` no longer prompts for role (commissioner/player)
- `CommissionerHomeScreen` is removed or unreachable from navigation
- `HomeWrapper` routes directly to a draft-oriented home instead of branching by role
- `AuthContext` no longer stores or checks `role`
- The `AppBanner` no longer shows a role pill

** COMPLETED**

### US-0.2: Remove commissioner league workspace ✅ COMPLETED
**As a** drafter, **I want** the commissioner league management screen removed, **so that** the app does not present features irrelevant to draft assistance.

**Acceptance criteria:**
- `CommissionerLeagueScreen` is removed or unreachable
- Route `/commissioner-league/:leagueId` is removed from `App.js`
- Manager approval, announcement broadcast, draft pause/resume (commissioner controls) are gone
- Audit log for commissioner actions is gone

** COMPLETED**

### US-0.3: Rescope league as a single-owner draft container ✅ COMPLETED
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

### US-0.4: Remove season/standings/schedule concepts ✅ COMPLETED
**As a** drafter, **I want** all references to seasons, standings, and schedules removed, **so that** the product clearly focuses on the draft and doesn't carry dead code.

**Acceptance criteria:**
- `League` model fields `seasonYear`, `isActive`, `leagueMode`, `scoringConfig` (and anything not listed in US-0.3) are removed
- No UI references to "season", "standings", "schedule", or post-draft play
- No controllers, routes, or models exist for standings/schedules
- Tests no longer exercise those code paths

** COMPLETED**

### US-0.5: Clean up unused server dependencies ✅ COMPLETED
**As a** developer, **I want** unused packages (`sequelize`, `pg`, `pg-hstore`, duplicate `bcrypt`/`bcryptjs`) removed from `server/package.json`, **so that** the dependency tree reflects actual usage.

**Acceptance criteria:**
- `sequelize`, `pg`, `pg-hstore` removed from `package.json`
- Only one of `bcrypt` / `bcryptjs` remains (whichever controllers actually use)
- `npm install` succeeds with no extraneous packages

** COMPLETED**

---

## Epic 1: Draft Session Setup

### US-1.1: Create a new draft session ✅ COMPLETED
**As a** drafter, **I want** to create a new draft session with a name, **so that** I can begin configuring my auction draft.

**Acceptance criteria:**
- A "Create Draft" action is available from the home screen
- User provides a draft session name
- System creates a `DraftSession` record with `status: "setup"` and `createdAt` timestamp
- User is taken to the draft session configuration screen
- `draftSessionId` is generated and stored

** COMPLETED**

### US-1.2: Configure number of teams ✅ COMPLETED
**As a** drafter, **I want** to specify how many teams are in my league (e.g. 10, 12, 14), **so that** budgets and roster math are correct.

**Acceptance criteria:**
- Numeric input for `numberOfTeams` (min 2, max 30)
- Value persists in `LeagueSettings` within the draft session
- Changing the number regenerates the `teams[]` array to match

** COMPLETED**

### US-1.3: Configure salary cap ✅ COMPLETED
**As a** drafter, **I want** to set the salary cap per team (e.g. $260), **so that** budget tracking is accurate.

**Acceptance criteria:**
- Numeric input for `salaryCap` (min 1)
- Value persists in `LeagueSettings`
- Each team's `budgetRemaining` initializes to this value

** COMPLETED**

### US-1.4: Configure roster slots ✅ COMPLETED
**As a** drafter, **I want** to define roster slot counts by position (C, 1B, 2B, 3B, SS, OF, UTIL, SP, RP, BENCH), **so that** the app can track filled vs. open slots.

**Acceptance criteria:**
- UI shows each position with a numeric input for slot count
- Values persist in `LeagueSettings.rosterSlots`
- Total roster size is computed and displayed
- Default values are provided (e.g. standard 23-slot roster)

** COMPLETED**

### US-1.5: Set scoring type placeholder ✅ COMPLETED
**As a** drafter, **I want** to select a scoring type label (e.g. "5x5 Roto", "H2H Categories", "Points"), **so that** the session records my league format for later use.

**Acceptance criteria:**
- Dropdown or radio with common scoring type options
- Value persists in `LeagueSettings.scoringType`
- This is informational only for now (no scoring calculations)

** COMPLETED**

### US-1.6: Draft type defaults to auction ✅ COMPLETED
**As a** drafter, **I want** the draft type to default to "AUCTION" and be displayed but not editable (for now), **so that** the entire app is oriented around auction drafts.

**Acceptance criteria:**
- `LeagueSettings.draftType` is set to `"AUCTION"`
- Displayed as read-only in settings UI
- No snake/linear draft option exists

** COMPLETED**

### US-1.7: Name fantasy teams ✅ COMPLETED
**As a** drafter, **I want** to assign names to each fantasy team, **so that** I can identify who is purchasing players during the draft.

**Acceptance criteria:**
- For each team (based on `numberOfTeams`), a text input for team name
- Default names are `fantasy-team-1`, `fantasy-team-2`, etc.
- User can rename any team (e.g. "Eric's Team", "Table 3 Guy")
- Each team gets a `teamId` in the format `fantasy-team-{n}`

** COMPLETED**

### US-1.8: Initialize draft session ✅ COMPLETED
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

### US-2.1: Create DraftSession server model ✅ COMPLETED
**As a** developer, **I want** a `DraftSession` Mongoose model, **so that** draft state is persisted.

**Acceptance criteria:**
- Schema includes: `draftSessionId`, `name`, `createdAt`, `leagueSettings` (embedded), `teams[]` (embedded), `draftHistory[]` (embedded), `availablePlayerIds[]`, `purchasedPlayerIds[]`, `status` (enum: setup, active, paused, completed)
- Model is exported and registered with Mongoose

** COMPLETED**

### US-2.2: Create FantasyTeam embedded schema ✅ COMPLETED
**As a** developer, **I want** a `FantasyTeam` sub-schema, **so that** each team's budget and roster are tracked within the draft session.

**Acceptance criteria:**
- Fields: `teamId`, `teamName`, `budgetRemaining`, `purchasedPlayers[]` (array of `{playerId, price}`), `filledRosterSlots` (map of position to count)
- Embedded within `DraftSession.teams[]`

** COMPLETED**

### US-2.3: Create DraftPurchase embedded schema ✅ COMPLETED
**As a** developer, **I want** a `DraftPurchase` sub-schema, **so that** each purchase is recorded in ordered history.

**Acceptance criteria:**
- Fields: `purchaseId`, `playerId`, `playerName`, `teamId`, `price`, `timestamp`, `nominationOrder`
- Embedded within `DraftSession.draftHistory[]`
- `nominationOrder` auto-increments per session

** COMPLETED**

### US-2.4: ~~Create PlayerStub model (local cache of Player Data API)~~ — SUPERSEDED
**Status:** **SUPERSEDED by US-3.3.** No local `PlayerStub` collection is required. The Draft Kit hydrates players on demand from `GET /api/v1/players/pool` via the `player-pool-service.js` proxy. Caching, if ever needed, will be added as a separate story under Epic 12 behind a feature flag.

**Why superseded:** maintaining a local `PlayerStub` collection would require a sync job and risk staleness against the Player Data API's `dataAsOf`. The proxy-and-intersect approach keeps the Player Data API as the single source of truth.

### US-2.5: Implement draft state service — initialize draft ✅ COMPLETED
**As a** developer, **I want** a server-side draft state service that initializes a draft, **so that** business logic is separated from route handlers.

**Acceptance criteria:**
- `initializeDraft(sessionId)` sets all teams' budgets, marks all players available, sets status to active
- Returns the initialized draft snapshot
- Validation: fails if session is already active

** COMPLETED**

### US-2.6: Implement draft state service — record purchase ✅ COMPLETED
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

### US-2.7: Implement draft state service — undo purchase ✅ COMPLETED
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

### US-2.8: Implement draft state service — edit purchase ✅ COMPLETED
**As a** developer, **I want** the draft state service to edit a purchase (change price or team), **so that** recording errors can be fixed without full undo.

**Acceptance criteria:**
- `editPurchase(sessionId, purchaseId, {newPrice?, newTeamId?})` performs:
  - If price changed: adjusts old team's budget (refund old, deduct new)
  - If team changed: moves player between teams, adjusts both budgets
  - Updates `draftHistory[]` entry
  - Validates new values (budget sufficient, etc.)
- Returns updated draft snapshot

** COMPLETED**

### US-2.9: Implement draft state service — get snapshot ✅ COMPLETED
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

### US-3.2: Populate `availablePlayerIds` from the Player Data API pool ✅ COMPLETED
**As a** drafter, **I want** a new draft session's available player pool to come from the Player Data API, **so that** the pool is always in sync with the upstream source of truth and the Draft Kit doesn't carry a stale seed.

**Acceptance criteria:**
- When a draft session transitions from `setup` to `active` (US-1.8 / US-8.4), the server calls `GET /api/v1/players/pool` on the Player Data API
- `availablePlayerIds` is populated from the response's `players[].playerId` (format `mlb-{id}`)
- A `pooledAt` timestamp is stored on the session so the client can warn if the pool is older than N hours
- If the Player Data API is unreachable and `PLAYER_API_URL` is unset, fall back to the legacy MongoDB `Player` collection's IDs (documented as a dev-only fallback)
- If the Player Data API is unreachable and `PLAYER_API_URL` **is** set, the endpoint returns `503` with a clear "Player Data API unavailable" message — the session is **not** transitioned to `active`

** COMPLETED**

### US-3.3: Expose player details to the draft room via a proxied endpoint ✅ COMPLETED
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

### US-4.1: Record a purchase from the draft board ✅ COMPLETED
**As a** drafter, **I want** to select a player, select a team, enter a price, and record the purchase, **so that** the draft state updates in real time.

**Acceptance criteria:**
- Draft Board tab has fields: player (autocomplete from available players), team (dropdown of session teams), price (numeric)
- "Record Purchase" button is enabled when all fields are filled
- On submit, calls the record purchase API
- On success: form clears, views refresh, success feedback shown
- On validation error (budget exceeded, player unavailable): error message displayed, no state change

** COMPLETED** (`DraftRoomScreen.js#renderDraftBoardTab` — player autocomplete + auctioned-by/won-by team dropdowns + price input; "Record Purchase" disabled until all filled; `handleRecordPurchase` calls `store.recordPurchase`, clears the form on success and surfaces server `errorMessage` inline on failure.)

### US-4.2: Player autocomplete filters to available players only ✅ COMPLETED
**As a** drafter, **I want** the player search in the purchase form to only show available (unpurchased) players, **so that** I cannot accidentally re-select a purchased player.

**Acceptance criteria:**
- Autocomplete queries only players where `isAvailable === true`
- Previously purchased players do not appear in suggestions
- If the user types a purchased player's name, no results appear

** COMPLETED** (`searchDraftBoardPlayers()` filters by `isAvailable()` against the `availableSet` derived from `draftSession.availablePlayerIds`; the API fallback path applies the same filter so server-side suggestions also exclude purchased players.)

### US-4.3: Team dropdown reflects session teams ✅ COMPLETED
**As a** drafter, **I want** the team dropdown in the purchase form to list the actual teams from my draft session, **so that** I select the correct buyer.

**Acceptance criteria:**
- Dropdown is populated from `DraftSession.teams[]`
- Shows team name and remaining budget (e.g. "Eric's Team ($238)")
- Updates after each purchase to show current budget

** COMPLETED** (`teamOptions` memoized selector renders `${getTeamName(t)} ($${t.budgetRemaining})`; live updates flow through the store's `RECORD_PURCHASE` reducer when the server returns the refreshed session.)

### US-4.4: Price validation on purchase ✅ COMPLETED
**As a** drafter, **I want** the app to validate that the purchase price does not exceed the team's remaining budget (accounting for $1 minimums for remaining roster slots), **so that** invalid purchases are prevented.

**Acceptance criteria:**
- Maximum allowed bid = `budgetRemaining - (openRosterSlots - 1)` (every unfilled slot needs at least $1)
- If entered price exceeds max bid, show inline validation error
- Price must be >= $1
- Price must be a whole number

** COMPLETED** (`maxBid = budgetRemaining - (openSlots - 1)` computed from the selected won-by team and roster config; `priceError` rejects non-integers, `< 1`, and overruns; error renders inline next to the price input and disables the submit button until cleared.)

---

## Epic 5: Undo/Edit Purchase (UI)

### US-5.1: Undo the most recent purchase ✅ COMPLETED
**As a** drafter, **I want** to undo the last recorded purchase with one click, **so that** I can quickly fix a mistake.

**Acceptance criteria:**
- An "Undo Last" button is visible in the draft board header
- Clicking it calls the undo API for the most recent `draftHistory` entry
- Player returns to available pool
- Team budget is restored
- Draft history entry is removed
- Button is disabled if history is empty

** COMPLETED** (header ⟲ button in `DraftRoomScreen` is `disabled={!draftSession?.draftHistory?.length}`; `handleUndoLastPurchase` resolves the last `purchaseId` and routes through `confirmAndUndo` so it shares the same prompt + server call as the per-row Undo. State reversal happens server-side via `draft-service.undoPurchase`.)

### US-5.2: Undo any purchase from draft history ✅ COMPLETED
**As a** drafter, **I want** to undo any specific purchase from the draft history log, **so that** I can correct errors found later.

**Acceptance criteria:**
- Each row in the draft history table has an "Undo" action
- Clicking it calls the undo API for that specific `purchaseId`
- All state effects are reversed (availability, budget, roster)
- The history list re-renders without that entry
- Confirmation prompt before undo ("Are you sure?")

** COMPLETED** (each draft-history row has an Undo button that calls `handleUndoRowPurchase`, which routes through `confirmAndUndo` — a `window.confirm("Undo {player} to {team} for $${price}?")` prompt; on accept, calls `store.undoPurchase` which fires the server `DELETE /draft-sessions/:id/purchases/:purchaseId`. Cancel aborts with no state change.)

### US-5.3: Edit a purchase price ✅ COMPLETED
**As a** drafter, **I want** to edit the price of a recorded purchase, **so that** I can fix a typo without undoing and re-entering.

**Acceptance criteria:**
- Each row in draft history has an "Edit" action
- Clicking it opens an inline or modal editor for price (and optionally team)
- On save, calls the edit purchase API
- Budgets adjust (old team gets refund of difference, or new team is charged)
- Validation applies (new price must be affordable)

** COMPLETED** (Edit button on each row triggers `handleStartEdit` which swaps the row to inline editors for team + price. `handleSaveEdit` validates: integer ≥ $1, and `projectedBudget = currentBudget + refundIfSameTeam − newPrice` must be ≥ remaining open slots × $1. On client validation failure, an inline `editError` renders next to the price field and the Save button is held; on server failure (e.g. roster full), the upstream `errorMessage` is surfaced in the same slot. Server `PUT /draft-sessions/:id/purchases/:purchaseId` handles the budget delta.)

### US-5.4: Edit the purchasing team of a purchase ✅ COMPLETED
**As a** drafter, **I want** to change which team a purchase is assigned to, **so that** I can fix a team-selection error.

**Acceptance criteria:**
- The edit modal/inline allows changing the team dropdown
- On save: old team's budget is restored, new team's budget is charged
- Player moves from old team's roster to new team's roster
- Validation: new team must have sufficient budget and open roster slots

** COMPLETED** (the inline editor includes a team `<select>` populated from `teamOptions` (showing `{teamName} ($budget)`); the same `handleSaveEdit` validation path checks the destination team — when the team changes (`!sameTeam`), the projection uses the new team's full budget without refund, and roster capacity is checked from `purchasedPlayers.length + 1 ≤ totalSlots`. The server's `editPurchase` does the actual roster-slot swap.)

---

## Epic 6: Basic Views

### US-6.1: Available players view ✅ COMPLETED
**As a** drafter, **I want** to see all available (unpurchased) players in a searchable, filterable table, **so that** I know who is still on the board.

**Acceptance criteria:**
- Players tab shows only available players
- Columns: Player Name, Positions, MLB Team, (optionally projected stats)
- Search by name filters the list
- Filter by position filters the list
- Count of available players is displayed
- Purchased players are excluded

** COMPLETED** (`renderPlayersTab` table; `displayedPlayers` memo filters by `availableSet` (from `draftSession.availablePlayerIds`), the new `positionFilter` chip row, and the existing `injuryOnly` toggle. Count pill renders `${displayedPlayers.length} of ${availableSet.size} Available` so it tracks the live state, not the stale API total.)

### US-6.2: Purchased players view ✅ COMPLETED
**As a** drafter, **I want** to see all purchased players with their buyer and price, **so that** I can track what has been drafted.

**Acceptance criteria:**
- A "Purchased" view/tab shows all purchased players
- Columns: Player Name, Positions, Team That Bought, Price
- Sortable by price, team, or order of purchase
- Count of purchased players displayed

** COMPLETED** (new `Purchased` tab + `renderPurchasedTab` shows every `draftHistory` row with #, Player, Position, Team That Bought, Price; sort chips for `order | price | team`; count pill in the header tracks `draftHistory.length`.)

### US-6.3: Team budgets view ✅ COMPLETED
**As a** drafter, **I want** to see every team's remaining budget, roster slots filled, and max bid, **so that** I can gauge the competitive landscape.

**Acceptance criteria:**
- Teams tab shows all fantasy teams in the session
- For each team: name, budget remaining, budget spent, roster slots filled / total, max possible bid
- Max bid = `budgetRemaining - (openSlots - 1)`
- Updates in real time after each purchase

** COMPLETED** (`renderTeamsTab` is now a real table: Team / Budget Remaining / Budget Spent (`salaryCap − budgetRemaining`) / Slots Filled (`filled / target`) / Max Bid (`budgetRemaining − (openSlots − 1)`). Updates flow live via the store's `RECORD_PURCHASE`/`UPDATE_DRAFT_SESSION` reducers.)

### US-6.4: Draft history view ✅ COMPLETED
**As a** drafter, **I want** to see the ordered log of all purchases, **so that** I can review what happened in the draft.

**Acceptance criteria:**
- Draft Board tab shows a table of all purchases in chronological order
- Columns: #, Player Name, Team, Price, Timestamp
- Most recent purchase is at the top
- Each row has Undo and Edit actions (from Epic 5)
- Empty state: "No picks recorded yet"

** COMPLETED** (`renderDraftBoardTab` "Draft Results Log" table — # / Player / Auctioned By / Won By / Price / Notes / Actions; per-row Undo + Edit (Epic 5); empty state renders "No picks logged yet".)

### US-6.5: My team view / roster ✅ COMPLETED
**As a** drafter, **I want** to designate one team as "my team" and see my roster and budget prominently, **so that** I can focus on my own draft strategy.

**Acceptance criteria:**
- User can mark one team as "My Team" (persisted in session or locally)
- Sidebar budget tracker shows "My Team" budget, max bid, avg $/remaining slot
- "My Roster" tab shows my purchased players by position slot
- Filled vs. open slots are clearly indicated

** COMPLETED** (server `updateDraftSession` accepts `myTeamId`; client store action `setMyTeam` posts via `PUT /draft-sessions/:id`. UI: "Set as Mine" button on each row of the Teams tab AND a button-row picker in the My Roster tab. `myTeam` derivation falls back to the first team when nothing is marked. Roster tab shows a Position / Filled / Target / Open table plus a list of purchased players + price for that team. Sidebar binds to `myTeam` for Remaining Budget, Maximum Bid (using live open slots), and Avg $/Open Slot.)

### US-6.6: Sidebar budget tracker updates live ✅ COMPLETED
**As a** drafter, **I want** the sidebar budget tracker to update immediately after every purchase, **so that** I always see current numbers.

**Acceptance criteria:**
- Remaining budget updates on purchase/undo/edit
- Max bid recalculates
- Avg $/player and avg budget/slot recalculate
- Roster planning section shows filled/open per position

** COMPLETED** (sidebar adds an `Avg $/Player` row (`spent / purchased.length`) alongside the existing `Avg $/Open Slot`. `buildRosterPlanner(draftSession, teamId)` now reads `filled` from `team.filledRosterSlots` instead of returning hardcoded 0; the Roster Planning panel renders `${filled} / ${target}` per position with a "Filled" pill or `Need N` for the open count, and "Next Priority" advances as slots fill. Everything reflows automatically because the store's reducers replace `currentDraftSession` after each purchase/undo/edit.)

---

## Epic 7: State Validation & Integrity (Milestone 2)

### US-7.1: Prevent duplicate player purchases ✅ COMPLETED
**As a** drafter, **I want** the system to reject a purchase if the player is already purchased, **so that** the draft state stays consistent.

**Acceptance criteria:**
- Server returns 400 with clear error message if `playerId` is in `purchasedPlayerIds`
- UI shows the error inline
- No state change occurs

** COMPLETED** (`draft-service.recordPurchase` now checks `purchasedPlayerIds` first and returns the specific message `Player has already been purchased in this draft session.` — distinct from the generic "not available" path. Controller maps service `errorMessage` → HTTP 400; client renders inline via `setEntryError`. `tests/draft-service.test.js` adds an explicit duplicate-purchase test that asserts the message AND verifies no state change: team1 still owns the player, team2's budget is intact, no extra history entry.)

### US-7.2: Prevent budget overrun ✅ COMPLETED
**As a** drafter, **I want** the system to reject a purchase if the team cannot afford it, **so that** budgets remain valid.

**Acceptance criteria:**
- Server validates `price <= team.budgetRemaining - (openSlots - 1)`
- Returns 400 with "Insufficient budget" if violated
- UI shows the error inline

** COMPLETED** (`draft-service.recordPurchase` computes `maxBid = budgetRemaining − (openSlots − 1)` and returns `Team has insufficient budget.` when `price > maxBid`. Controller returns 400; client renders inline. `tests/draft-service.test.js` covers (a) overrun rejection with no-state-change assertions (budget intact, player still in `availablePlayerIds`, history empty) and (b) the boundary case at exactly `maxBid` succeeding while `maxBid + 1` rejects.)

### US-7.3: Prevent roster overflow ✅ COMPLETED
**As a** drafter, **I want** the system to reject a purchase if the team's roster is full, **so that** no team exceeds their roster size.

**Acceptance criteria:**
- Server validates that the team has at least one open roster slot
- Returns 400 with "Roster full" if all slots are filled
- Optionally: position-specific enforcement

** COMPLETED** (`draft-service.recordPurchase` computes `openSlots = totalSlots − totalFilled` and returns `Team roster is full.` when `openSlots <= 0`. Controller maps to HTTP 400. `tests/draft-service.test.js` adds (a) full-roster rejection with no-state-change assertions (budget intact, history empty, player still in `availablePlayerIds`) and (b) a boundary test where a team with 1 open slot accepts the next pick but the one after that hits the full-roster guard. Position-specific enforcement is intentionally deferred — flexible position eligibility (e.g. UTIL-eligible bats slotting into BENCH) makes per-position validation a UX-trap that's better handled in a future polish story.)

### US-7.4: Validate draft session status before mutations ✅ COMPLETED
**As a** developer, **I want** all mutation endpoints to check that the draft session is active, **so that** completed or paused drafts cannot be modified.

**Acceptance criteria:**
- `recordPurchase`, `undoPurchase`, `editPurchase` reject if `status !== "active"`
- Returns 400 with "Draft is not active"
- Setup-phase sessions also reject purchases

** COMPLETED** (`draft-service.js` replaces the previous `MUTATION_BLOCKED_STATUSES` (which only blocked `paused`/`completed`) with a single `rejectInactive(session)` helper that requires `status === 'active'` — `setup` now correctly rejects mutations because the explicit `POST /start` action is the documented transition. All three mutation methods call it before any state read or write. Error message includes the offending status: `Draft is not active (current status: <status>).`. `tests/draft-service.test.js` adds parametrized `test.each(['setup','paused','completed'])` matrices for `recordPurchase`, `undoPurchase`, and `editPurchase` — 9 cases total — each asserting both the rejection AND no-state-change (history length, budget intact, player still available/purchased).)

### US-7.5: State consistency tests ✅ COMPLETED
**As a** developer, **I want** automated tests for draft state transitions, **so that** regressions are caught early.

**Acceptance criteria:**
- Tests cover: initialize, purchase, undo, edit, double-purchase rejection, budget overrun rejection, roster full rejection
- Tests verify that `availablePlayerIds.length + purchasedPlayerIds.length === totalPlayers` after every operation
- Tests verify that `sum of all team budgets spent + all team budgets remaining === numberOfTeams * salaryCap`
- Tests run in CI (vitest)

** COMPLETED** (operation coverage was already in `tests/draft-service.test.js` from earlier stories — initialize, purchase happy-path, undo, edit price/team, US-7.1 duplicate, US-7.2 overrun, US-7.3 roster full, US-7.4 inactive-status guards. Added a dedicated `US-7.5: state consistency invariants` describe block with two helpers: `assertPlayerConservation` (asserts `available.length + purchased.length === totalPlayers` AND no overlap between the two arrays) and `assertBudgetConservation` (asserts `sum(team.budgetRemaining) + sum(team.purchasedPlayers.price) === numberOfTeams * salaryCap`). Two tests apply both helpers: (1) a 7-step happy-path sequence (initialize → record × 2 → edit price → edit team → undo → re-record) re-asserting after each step, and (2) a rejection-survival test that records a baseline then attempts a duplicate-player purchase and a budget overrun, asserting both invariants still hold after each rejected call. Tests run via vitest as part of `npm test`. **54/54 passing.**)

---

## Epic 8: API Routes for Draft Operations

### US-8.1: Create draft session endpoint ✅ COMPLETED
**As a** developer, **I want** `POST /api/draft-sessions` to create a new draft session.

**Acceptance criteria:**
- Accepts `{name}` in body
- Returns created session with ID and default settings
- Requires authentication

** COMPLETED**

### US-8.2: Get draft session endpoint ✅ COMPLETED
**As a** developer, **I want** `GET /api/draft-sessions/:id` to return the full draft snapshot.

**Acceptance criteria:**
- Returns full `DraftSession` including teams, history, available/purchased counts
- Requires authentication
- Returns 404 if not found

** COMPLETED**

### US-8.3: Update draft settings endpoint ✅ COMPLETED
**As a** developer, **I want** `PUT /api/draft-sessions/:id/settings` to update league settings.

**Acceptance criteria:**
- Accepts `{numberOfTeams, salaryCap, rosterSlots, scoringType, teams}`
- Only allowed when `status === "setup"`
- Returns updated session

** COMPLETED**

### US-8.4: Explicit start-draft endpoint ✅ COMPLETED
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

### US-8.5: Record purchase endpoint ✅ COMPLETED
**As a** developer, **I want** `POST /api/draft-sessions/:id/purchases` to record a purchase.

**Acceptance criteria:**
- Accepts `{playerId, teamId, price}`
- Runs full validation (availability, budget, roster)
- Returns updated draft snapshot on success
- Returns 400 with specific error on validation failure

** COMPLETED**

### US-8.6: Undo purchase endpoint ✅ COMPLETED
**As a** developer, **I want** `DELETE /api/draft-sessions/:id/purchases/:purchaseId` to undo a purchase.

**Acceptance criteria:**
- Reverses all state effects of the purchase
- Returns updated draft snapshot
- Returns 404 if purchase not found

** COMPLETED** (`DELETE /draft-sessions/:draftSessionId/purchases/:purchaseId` route in `draft-session-router.js` → `undoPurchase` controller delegates to `draft-service.undoPurchase` which restores availability, refunds budget, decrements `filledRosterSlots`, and removes the history entry. Controller now returns **404** specifically when the service errors with "Purchase not found." (regex-matched), keeping other failures as 400. New HTTP test file `tests/draft-session-routes.test.js` (with `createApp` helper extended to mount the draft-sessions router) covers the contract: `401` no-auth, `403` non-owner, `404` unknown session, `404` unknown purchaseId, and `200` success with the reversed snapshot (player back in `availablePlayerIds`, history empty, team budget refunded to $260).)

### US-8.7: Edit purchase endpoint ✅ COMPLETED
**As a** developer, **I want** `PUT /api/draft-sessions/:id/purchases/:purchaseId` to edit a purchase.

**Acceptance criteria:**
- Accepts `{price?, teamId?}`
- Validates new values
- Adjusts budgets and rosters accordingly
- Returns updated draft snapshot

### US-8.8: List user's draft sessions endpoint ✅ COMPLETED
**As a** developer, **I want** `GET /api/draft-sessions` to return all sessions for the authenticated user.

**Acceptance criteria:**
- Returns array of `{draftSessionId, name, status, createdAt, numberOfTeams}`
- Sorted by `createdAt` descending
- Requires authentication

### US-8.9: Valuations proxy endpoint ✅ COMPLETED
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

### US-9.1: Create DraftContext for client-side draft state ⚠️ SUPERSEDED — GlobalStoreContext holds the draft session instead
**As a** developer, **I want** a React context that holds the active draft session state, **so that** all views read from a single source of truth.

**Acceptance criteria:**
- `DraftContext` provides: `session`, `teams`, `availablePlayers`, `purchasedPlayers`, `draftHistory`, `myTeamId`
- Provides actions: `loadSession`, `recordPurchase`, `undoPurchase`, `editPurchase`, `setMyTeam`
- Actions call API endpoints and update local state on success
- All draft views consume this context

### US-9.2: Refactor DraftRoomScreen to consume DraftContext ⚠️ SUPERSEDED — DraftRoomScreen reads from GlobalStoreContext directly
**As a** developer, **I want** `DraftRoomScreen` refactored to read from `DraftContext`, **so that** UI logic is separated from business logic.

**Acceptance criteria:**
- `DraftRoomScreen` no longer holds purchase state directly
- All data comes from `DraftContext`
- Form submissions call context actions
- Component re-renders when context state changes

### US-9.3: Home screen shows draft sessions list ✅ COMPLETED
**As a** drafter, **I want** the home screen to list my draft sessions, **so that** I can resume a draft or start a new one.

**Acceptance criteria:**
- Home screen fetches `GET /api/draft-sessions`
- Shows each session with name, status badge, team count, date
- Click navigates to draft room or setup depending on status
- "Create New Draft" button starts US-1.1 flow

---

## Epic 10: Polish & UX (Milestone 2)

### US-10.1: Draft session status indicator ✅ COMPLETED
**Acceptance criteria:**
- Status badge displayed in draft room header
- Color-coded: Setup=blue, Active=green, Paused=yellow, Completed=gray

### US-10.2: Confirmation dialog for destructive actions ✅ COMPLETED
**Acceptance criteria:**
- Undo triggers "Are you sure you want to undo [Player] to [Team] for $[Price]?"
- Confirm/Cancel buttons
- No state change on Cancel

### US-10.3: Success/error toast notifications ✅ COMPLETED
**Acceptance criteria:**
- Green toast for success ("Juan Soto purchased by Team 3 for $47")
- Red toast for errors ("Insufficient budget for this purchase")
- Toasts auto-dismiss after 4 seconds

### US-10.4: Keyboard shortcut for quick purchase recording ✅ COMPLETED
**Acceptance criteria:**
- Enter key in price field triggers "Record Purchase" if form is valid
- Focus management: after recording, focus returns to player search field

### US-10.5: Responsive layout for the draft room ✅ COMPLETED
**Acceptance criteria:**
- Sidebar collapses or becomes a bottom bar on narrow screens
- Tables horizontally scroll on narrow screens
- Core actions remain accessible at all breakpoints

---

## Epic 11: API Integration Readiness (Milestone 3)

> This epic wires the Draft Kit to the Player Data API's valuation, recommendation, and player-pool endpoints. The canonical request/response contracts are owned by the Player Data API (see US-5.3, US-5.4, US-5.5 and US-6.1–6.4 in `PLAYER_DATA_API_USER_STORIES.md`). This epic is mostly client plumbing plus one serializer.

### US-11.1: Document the cross-repo `{leagueSettings, draftState}` contract ✅ COMPLETED
**As a** developer maintaining both repos, **I want** a single authoritative description of the payload the Draft Kit sends to the Player Data API, **so that** breaking changes are caught at code-review time.

**Acceptance criteria:**
- A shared contract doc (in this repo's `docs/` or `README`) reproduces the shapes from Player Data API US-5.3 and US-5.4
- Documents the explicit mapping from the Draft Kit's `DraftSession.leagueSettings` (`numberOfTeams`, `salaryCap`, `rosterSlots` map, `scoringType`, `draftType`) to the engine fields
- Documents that `draftState.purchasedPlayers` is built from `DraftSession.draftHistory[]` + `teams[].purchasedPlayers[]`, and that `teamBudgets` and `filledRosterSlots` come from `teams[]`
- Lists the exact endpoints the Draft Kit will call: `/api/v1/players/pool`, `/api/v1/players/:playerId`, `/api/v1/players/valuations`, `/api/v1/players/recommendations`, `/api/v1/players/recommendations/nominations`, `/api/v1/usage`

### US-11.2: Add value column placeholder to player table ✅ COMPLETED
**Acceptance criteria:**
- "$ Value" column exists in available players table showing "--"
- Column header has a tooltip explaining it will show model-derived values once US-13.1 is wired
- Column renders the API's `projectedValue` when present, falls back to `--` otherwise

### US-11.3: Draft state export for API consumption ✅ COMPLETED
**Acceptance criteria:**
- `exportDraftState(sessionId)` returns a clean JSON payload matching the Player Data API contract from US-11.1:
  - `availablePlayerIds: string[]`
  - `purchasedPlayers: [{ playerId, teamId, price, positionFilled }]`
  - `teamBudgets: { [teamId]: number }`
  - `filledRosterSlots: { [teamId]: { [position]: number } }`
- No Mongoose internals or `_id` fields leak into the payload
- Player IDs use the `mlb-{id}` format; team IDs use `fantasy-team-{n}`
- Accompanied by `exportLeagueSettings(sessionId)` that returns the raw `leagueSettings` shape (the Player Data API handles normalization per US-5.3)

### US-11.4: Expand the licensed API client ✅ COMPLETED
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

### US-11.5: Migrate licensed API client to `/api/v1/*` ✅ COMPLETED
**As a** developer, **I want** the Draft Kit to hit the versioned Player Data API surface, **so that** legacy-route deprecation in the Player Data API (US-2.8 there) doesn't break us.

**Acceptance criteria:**
- All calls from `server/lib/licensed-player-api.js` go to `/api/v1/*`
- Optional `PLAYER_API_LEGACY=1` env flag falls back to unversioned routes for local testing against older API builds
- Health of the configured base URL is logged once on server startup (versioned path reachable, yes/no)
- README (`416-Minimum-Viable-Product/README.md`) updates its "Licensed Player Data API" examples to the versioned paths

### US-11.6: League-settings serializer for Player Data API calls ✅ COMPLETED
**As a** developer, **I want** a single helper that turns `DraftSession.leagueSettings` into whatever shape the Player Data API currently expects, **so that** future contract tweaks happen in one place.

**Acceptance criteria:**
- `server/lib/player-api-adapter.js` exports `toPlayerApiLeagueSettings(session.leagueSettings)` and `toPlayerApiDraftState(session)`
- Output matches the contract documented in US-11.1 / US-5.3 / US-5.4
- `toPlayerApiDraftState` handles edge cases: no purchases yet, `teams` with missing `filledRosterSlots`, paused/completed sessions
- Unit tested with a representative session fixture

### US-11.7: Surface Player Data API data-freshness in the draft room ✅ COMPLETED
**As a** drafter, **I want** to see when the upstream player data was last refreshed, **so that** I know whether injury flags are current.

**Acceptance criteria:**
- When the draft kit calls `/api/v1/players/pool` or `/api/v1/players/valuations`, it forwards the response's `dataAsOf` and `staleWarnings` to the client
- Draft room header renders a small "Player data as of X ago" line
- If `staleWarnings` is non-empty, render a yellow badge and list the stale sources on hover

### US-11.8: Translate Player Data API errors to the Draft Kit error shape ✅ COMPLETED
**As a** client developer, **I want** error shapes from the Player Data API to be translated into the Draft Kit's `{ success, errorMessage }` shape on the server side, **so that** the client only has to handle one error convention.

**Acceptance criteria:**
- `server/lib/licensed-player-api.js` detects the Player Data API's `{ success: false, error, code, fields? }` shape and throws a typed error including `code` and field-level `fields[]`
- The Draft Kit controllers calling these methods translate that into `{ success: false, errorMessage, errorCode, fieldErrors }` in their JSON responses (extending the existing shape, not breaking it)
- `400` responses from the Player Data API surface as `400` from the Draft Kit (not swallowed as `500`)
- The client can read `fieldErrors` to show inline validation messages on the purchase / valuation forms

---

## Epic 12: External Data Integration (Milestone 4)

> **Rewrite note (was ingestion, now consumption):** The Player Data API owns MLB Stats API ingestion (its Epic 4). This epic used to describe the Draft Kit doing its own sync; that duplicated work. These stories now describe the Draft Kit **consuming** what the Player Data API already produces. If/when a local cache is ever desired, it is additive — the pull-through flow is the baseline.

### US-12.1: Hydrate player details from the Player Data API pool ✅ COMPLETED
**As a** drafter, **I want** the draft room's player list to carry full metadata (name, positions, team, status, depth-chart info), **so that** I can judge playing time before bidding.

**Acceptance criteria:**
- On draft start (US-3.2) and on each `GET /api/draft-sessions/:id/players` call, the Draft Kit server retrieves player records from `GET /api/v1/players/pool` via the US-11.4 client
- Records are passed through to the client in `PlayerStub` shape plus `depthChartRank`, `depthChartPosition`, and `dataAsOf`
- A manual "Refresh player data" button in the draft room re-fetches the pool and updates displayed rows in place
- No local `PlayerStub` collection is required; if caching is added later, it is behind a feature flag

### US-12.2: Display injury status from Player Data API ✅ COMPLETED
**As a** drafter, **I want** to see each player's injury status (e.g. `IL-10`, `IL-60`, `DTD`, `active`), **so that** I can avoid bidding on unavailable players.

**Acceptance criteria:**
- `status` field from the Player Data API's `PlayerStub` is displayed as a badge next to the player name
- Status colors: red for `IL-*`, yellow for `DTD`, gray for `minors`/`DFA`, none for `active`
- No polling from the Draft Kit — the Player Data API's refresh cadence (every 15–60 min per its US-4.2) is the source of truth
- Sort by `status` available on the Players tab

### US-12.3: Display depth-chart / roster status from Player Data API ✅ COMPLETED
**As a** drafter, **I want** to see whether a player is a starter, backup, or in the minors, **so that** I can assess playing time quickly.

**Acceptance criteria:**
- `depthChartRank` and `depthChartPosition` from the Player Data API response are rendered as a badge or column in the player table (e.g. "SP1", "OF-bench", "AAA")
- Filter "Show only starters" toggles `depthChartRank === 1`
- When a player is sent down or recalled between refreshes, the next pool refresh picks up the change with no Draft Kit code change

---

## Epic 13: Valuation & Recommendation Engine (Milestone 5)

> Depends on Player Data API Epics 5 and 6, and Draft Kit Epic 11 (specifically US-11.4 for the client methods and US-11.6 for the serializers).

### US-13.1: Request live valuations from the Player Data API ✅ COMPLETED
**Acceptance criteria:**
- After each recorded purchase (and on draft-room load), the Draft Kit server calls `postValuations({ leagueSettings, draftState })` via US-11.4
- `leagueSettings` is the session's raw leagueSettings (the Player Data API handles normalization per its US-5.3)
- `draftState` is built by `toPlayerApiDraftState(session)` from US-11.6 (includes `availablePlayerIds`, `purchasedPlayers`, `teamBudgets`, `filledRosterSlots`)
- Response populates the "$ Value" column for available players via `DraftContext`
- Values change as the draft progresses (verified by eyeballing the column mid-draft)
- If the Player Data API returns `valuations: []` with a "no stats" meta, the UI shows the placeholder `--` (no crash)

### US-13.2: Display recommendation tier for available players ✅ COMPLETED
**Acceptance criteria:**
- Recommendation column in the player table renders the `tier` value returned by the Player Data API (per its US-6.1)
- **Color mapping is rendered from the API `tier` field only** — the Draft Kit does not compute thresholds locally:
  - `"buy"` → green
  - `"fair"` → yellow
  - `"avoid"` → red
- Hovering the badge shows the API's `reason` string
- Column is hidden while `recommendations` is empty / loading

### US-13.3: Show value-over-replacement ("Surplus") for remaining players ✅ COMPLETED
**Acceptance criteria:**
- "Surplus" column renders the `valueGap` field from the Player Data API (per its US-5.5)
- For available players (no `purchasePrice`), `valueGap` is `null` → column shows `--`
- For purchased players, `valueGap = projectedValue − purchasePrice`
- Positive surplus highlighted in green, negative in red
- Sortable, so best values float to top
- Draft Kit does **not** recompute surplus locally

### US-13.4: Position scarcity alerts ✅ COMPLETED
**Acceptance criteria:**
- The Draft Kit pulls position-scarcity metadata from the Player Data API's `/players/recommendations` response (threshold + position list)
- Thresholds and triggering logic live in the API response metadata — not hardcoded in the Draft Kit client
- Alert appears in the sidebar and optionally as a toast when a position moves into the scarce state
- Alert includes the API-supplied `reason` string so the copy stays consistent with the recommendation engine

---

## Epic 14: End-to-End Validation (Milestone 5)

> Both repos are now implemented enough to talk to each other for the pool flow (US-3.2, US-3.3). These stories close the loop with executable proof that the two halves work together.

### US-14.1: Two-server local boot script ✅ COMPLETED
**As a** developer, **I want** a single command that boots both the Player Data API and the Draft Kit server with a known-good `PLAYER_API_URL`, `PLAYER_API_KEY`, and Mongo URI, **so that** any contributor can reproduce a draft end-to-end without reading two READMEs.

**Acceptance criteria:**
- `docs/dev-setup.md` (or root `README`) documents the exact env vars on each side
- A script (e.g. `npm run dev:full` at the project root, or a documented two-terminal recipe) brings up both servers
- Health check: hitting `GET /api/v1/health` on the API and `GET /draft-sessions/<id>` on the Draft Kit both return 200 against the same Mongo + same API key

### US-14.2: End-to-end smoke test ✅ COMPLETED
**As a** developer, **I want** an automated smoke test that exercises the full happy path against a real (in-process or containerized) Player Data API, **so that** cross-repo contract drift is caught before merge.

**Acceptance criteria:**
- Test boots a Player Data API instance (in-memory DB + seed) and points the Draft Kit at it
- Test scenario, in order: register user → create league → POST `/draft-sessions` → PUT settings → POST `/draft-sessions/:id/start` (US-8.4) → GET `/draft-sessions/:id/players?status=available` (US-3.3) → POST a purchase (US-8.5) → DELETE the purchase (US-8.6) → assert `availablePlayerIds.length` and `sum(team budgets) + sum(prices)` invariants hold
- Test fails loudly if upstream pool shape changes (e.g. `playerId` field renamed)
- Runs in CI; gated behind `RUN_E2E=1` locally so default `npm test` stays fast

### US-14.3: Contract drift guard ✅ COMPLETED
**As a** developer, **I want** `toPlayerApiLeagueSettings` and `toPlayerApiDraftState` (US-11.6) covered by a contract test that loads a fixture from the Player Data API repo's documented schema, **so that** if the API changes the request shape, the Draft Kit's serializer test fails — not a live draft.

**Acceptance criteria:**
- Fixture file checked into both repos (or pulled from a single shared location) with a representative `{ leagueSettings, draftState }` payload
- Test asserts the serializer output matches the fixture schema exactly (no extra/missing top-level keys)
- Documented update procedure: when the Player Data API revs the shape, both repos update the fixture in lockstep

---

## Epic 15: Year-Aware Drafts (Rubric: Draft Kit Accounts)

> **Rubric mapping:** "User can create draft for given year" (2pt), "User can access drafts from current and past years" (2pt), "Can create new draft using completed draft from previous year" (2pt) — 6pt total.

### US-15.1: Associate every draft with a season year ✅ COMPLETED
**As a** drafter, **I want** every draft session tagged with a `seasonYear`, **so that** I can keep multiple years of drafts and look back at past results.

**Acceptance criteria:**
- `DraftSession.leagueSettings.seasonYear` (integer, e.g. 2026) added to the Mongoose schema; default is the current calendar year
- Setup screen exposes a year input alongside `numberOfTeams`, defaults to the current year, accepts any integer ≥ 2000
- `serializeSession` includes `seasonYear` in the response
- `tests/draft-service.test.js` asserts the field round-trips through create → update → fetch

### US-15.2: Filter home-screen drafts by year ✅ COMPLETED
**As a** drafter, **I want** the home screen to group leagues by season year and let me filter to a specific year, **so that** my history doesn't get cluttered as years go by.

**Acceptance criteria:**
- `PlayerHomeScreen` shows a year selector chip row populated from the distinct years across the user's leagues
- Selecting a year filters the league list; "All years" remains the default
- Section headers display the year for each group when "All years" is active
- Empty state per year reads "No drafts in <year> yet"

### US-15.3: Clone a completed draft from a previous year ✅ COMPLETED
**As a** drafter, **I want** to start a new year's draft pre-populated from a completed prior-year draft (same teams, same league settings, same keepers), **so that** league setup is one click instead of a dozen.

**Acceptance criteria:**
- New endpoint `POST /leagues/:leagueId/clone` accepts `{ targetYear, sourceLeagueId? }` and creates a fresh league + draft session for `targetYear`
- Cloned `leagueSettings` (teams count, salary cap, roster slots, scoring, draft type, custom positions/stats) carry over
- Cloned `teams[]` carry over team names; budgets reset to `salaryCap`; `purchasedPlayers[]` is empty by default
- If the source draft has keepers (US-18.1), they migrate to the new draft (player + price + contract length, decremented by 1 year)
- New draft starts in `setup` status — owner reviews, then runs `POST /start` as usual
- UI: "Use Last Year" button on each league card invokes this when the league has a completed prior-year draft

---

## Epic 16: Account Auth Hardening (Rubric: Draft Kit Accounts)

> **Rubric mapping:** "Account Creation & Login Mechanisms" (2pt), "Account Password/Login Reset/Retrieval" (2pt) — 4pt total.

### US-16.1: Document and verify the existing register/login/logout flow ✅ COMPLETED
**As a** new drafter, **I want** account creation, login, and logout to work end-to-end, **so that** my drafts are persisted to my account.

**Acceptance criteria:**
- `RegisterScreen` collects `email + userName + password` and calls `POST /auth/register`; success redirects to `/home`
- `LoginScreen` calls `POST /auth/login`; sets cookie-based JWT; success redirects to `/home`
- `GET /auth/loggedIn` is the source of truth for "is the user signed in" and runs on every protected screen mount
- Logout clears the cookie + auth context state
- Integration test `tests/auth-routes.test.js` asserts the full flow: register → loggedIn:true → logout → loggedIn:false

### US-16.2: Password reset / retrieval flow ✅ COMPLETED
**As a** drafter who forgot my password, **I want** to reset it via my email, **so that** I'm not locked out of my drafts.

**Acceptance criteria:**
- `ForgotPasswordScreen` collects an email and calls `POST /auth/forgot-password`
- Server generates a single-use, time-limited reset token (15 minute TTL) and either emails it (production) or returns it directly in dev mode for testing
- New `ResetPasswordScreen` accepts the token + a new password; calls `POST /auth/reset-password`; on success redirects to `/login`
- Tokens are invalidated after use; expired tokens return `400` with `code: "TOKEN_EXPIRED"`
- Integration test exercises the full path: forgot → token issued → reset → can log in with the new password

---

## Epic 17: League Configuration Extensions (Rubric: Draft Kit Prep)

> **Rubric mapping:** "Setup Draft using AL-only / NL-only / all MLB" (2pt), "Custom Stats Selection for League" (2pt), "Custom Hitter and Pitcher Positions for League" (2pt) — 6pt total.

### US-17.1: League scope (AL-only / NL-only / MLB) ✅ COMPLETED
**As a** drafter, **I want** to choose whether my league is American League–only, National League–only, or all-MLB, **so that** the player pool is scoped correctly.

**Acceptance criteria:**
- `leagueSettings.leagueScope` field — enum: `'MLB' | 'AL' | 'NL'` (default `'MLB'`)
- Setup screen renders a 3-button toggle for the scope
- When the draft starts, `availablePlayerIds` is filtered by MLB league before persisting (the Player Data API's `/players/pool` accepts a `league` query param — Draft Kit forwards `leagueScope`)
- Mid-draft scope changes are blocked (status must be `setup`)

### US-17.2: Custom stats selection for league ✅ COMPLETED
**As a** drafter, **I want** to pick which stats my league uses (e.g. for 5×5 Roto, swap OBP for AVG), **so that** valuations match my league's scoring.

**Acceptance criteria:**
- `leagueSettings.statCategories` — `{ hitting: string[], pitching: string[] }` overriding the `scoringType` preset
- Setup screen exposes a stat-category picker per side (multi-select) with the preset shown as the starting point
- Cross-repo contract: the picker's selections flow into `leagueSettings` and the Player Data API's `/valuations` endpoint accepts the override (per the API's US-5.3 normalize step)
- Default behavior unchanged when `statCategories` is unset (presets apply)

### US-17.3: Custom hitter & pitcher positions for league ✅ COMPLETED
**As a** drafter, **I want** to define which positions count as hitters vs pitchers (e.g. add MI, CI, IF, NA), **so that** my league's roster slots aren't limited to the default set.

**Acceptance criteria:**
- `leagueSettings.positionCatalog` — `{ hitter: string[], pitcher: string[] }`; defaults to the existing C/1B/2B/3B/SS/OF/UTIL + SP/RP/P set
- Setup screen lets the owner add or remove position keys before draft start; mid-draft changes blocked
- The roster-slots editor in setup is driven by `positionCatalog` so adding "MI" adds a row to the slot grid
- Player eligibility check (US-18.3) consumes `positionCatalog` so a player listed at "MI" is matchable

---

## Epic 18: Pre-Draft Rosters & Keepers (Rubric: Draft Kit Prep)

> **Rubric mapping:** "User can enter pre-draft rosters with Contract and $ values" (2pt), "User can easily move player to another position within team" (2pt), "Kit only allows players to be moved to positions they are eligible for" (2pt), "Any players can be moved from one team to another" (2pt) — 8pt total.

### US-18.1: ✅ COMPLETED — see Enter pre-draft rosters with contract and price
**As a** drafter, **I want** to record keepers per team — player, price, contract years remaining — before the draft starts, **so that** budgets and slots are pre-debited at draft time.

**Acceptance criteria:**
- New "Keepers" tab on `DraftSessionSetupScreen` (only visible while status is `setup`)
- For each team, the owner can add multiple keepers via player-search autocomplete + numeric price + numeric contract-years
- Saving keepers writes to `team.keepers[] = [{ playerId, playerName, price, contractYears, positionAssigned }]` on the session
- When the draft starts, every keeper is converted into a `purchasedPlayer` entry (debits budget, fills the slot, adds a draft-history entry with `nominationOrder: 0` and `isKeeper: true`)
- Validation: keepers can't exceed team budget or roster size

### US-18.2: ✅ COMPLETED — see Move a rostered player to another position within the same team
**As a** drafter, **I want** to drag (or pick from a dropdown) a player from one of my position slots into another slot they're eligible for, **so that** I can optimize my lineup as picks come in.

**Acceptance criteria:**
- Each row in the My Roster tab and Teams tab exposes a "Move" action listing the eligible positions
- Picking a target slot calls `PUT /draft-sessions/:id/purchases/:purchaseId/position` with `{ positionFilled }`
- Server-side validation: target position must be in the player's eligibility list; target slot must have an opening
- `team.filledRosterSlots` is updated atomically (decrement old, increment new)

### US-18.3: ✅ COMPLETED — see Position eligibility enforcement
**As a** drafter, **I want** the system to reject moves to positions a player isn't eligible for, **so that** rosters stay legal.

**Acceptance criteria:**
- Player metadata includes `positions[]` (already in PlayerStub) representing eligibility
- The position dropdown in US-18.2 only shows eligible positions plus UTIL/BENCH (configurable via `leagueSettings.positionCatalog`)
- Server returns `400 { code: "POSITION_INELIGIBLE" }` if a malicious client requests an ineligible slot
- Test asserts: a 1B-only player cannot be moved to SS

### US-18.4: ✅ COMPLETED — see Move any player between teams (pre-draft and during-draft)
**As a** drafter, **I want** to move any player from one team to another at any point — keepers before the draft, recorded purchases during the draft — **so that** roster mistakes are easy to fix.

**Acceptance criteria:**
- Pre-draft (setup status): the keeper rows can have their team reassigned; budget on both teams updates
- During draft (active status): already covered by US-5.4 (edit purchase to change team)
- Reuses the validation from US-7.2/US-7.3 (destination team must have budget + open slot)

---

## Epic 19: Minor League Rosters (Rubric: Draft Kit Prep)

> **Rubric mapping:** "User can enter minor league player rosters" (2pt), "Minor league player not eligible for draft" (2pt), "Minor league players can be moved from one team to another" (2pt) — 6pt total.

### US-19.1: Enter minor league rosters per team ✅ COMPLETED
**As a** drafter in a dynasty league, **I want** to keep a separate minor league roster per team, **so that** prospects don't sit in the auction pool.

**Acceptance criteria:**
- `team.minorLeaguePlayers[] = [{ playerId, playerName, contractYears }]` on the session
- "Minors" sub-section in the Keepers tab — separate from major-league keepers, no price field
- Hard cap configurable via `leagueSettings.minorLeagueSlots` (default 6)

### US-19.2: Minor league players are excluded from the auction pool ✅ COMPLETED
**As a** drafter, **I want** any player on any team's minor league roster filtered out of the available player list, **so that** they can't be re-drafted.

**Acceptance criteria:**
- When the draft starts, `availablePlayerIds` is built by removing every player listed in any team's `minorLeaguePlayers[]` (in addition to the existing keeper exclusion)
- Players tab autocomplete + table both honor the exclusion
- Test asserts: a player on team1's minor roster does not appear in `availablePlayerIds`

### US-19.3: Move minor league players between teams ✅ COMPLETED
**As a** drafter, **I want** to move minor league players from one team to another (trade simulation), **so that** the dynasty league moves stay reflected in the kit.

**Acceptance criteria:**
- "Move" action on each minor league row, opening a team picker
- `PUT /draft-sessions/:id/minors/:playerId` with `{ teamId }` reassigns
- Validation: destination team must have a free minor league slot

---

## Epic 20: Player Notes (Rubric: Draft Kit Prep)

> **Rubric mapping:** "User can enter Player Notes before or during draft" (1pt), "User can edit Player Notes before or during draft" (1pt) — 2pt total.

### US-20.1: Enter player notes pre-draft and during draft ✅ COMPLETED
**As a** drafter, **I want** to attach a free-text note to any player, **so that** I remember my own intel ("UCL surgery summer '25", "Manager hates him") at the moment of the bid.

**Acceptance criteria:**
- `DraftSession.playerNotes` — `{ [playerId]: { text, updatedAt } }` map
- Each row in the Players tab and Player Detail panel exposes an "Add note" affordance
- Notes persist via `PUT /draft-sessions/:id/notes/:playerId` with `{ text }`
- The note icon in the table fills with color when a note exists for that player

### US-20.2: Edit and delete player notes ✅ COMPLETED
**As a** drafter, **I want** to edit or clear an existing note, **so that** stale intel doesn't trip me up.

**Acceptance criteria:**
- Same endpoint accepts `text: ""` to delete the entry
- UI: clicking an existing note opens an inline editor with Save / Cancel / Delete
- Deletion removes the key from `playerNotes` so the icon goes back to its empty state

---

## Epic 21: Player Details Panel (Rubric: Draft Day + Push)

> **Rubric mapping:** "Player Details — Stats, Age, Injury Status, Depth Chart, Transactions" (2pt) plus "Player Details — Depth Chart" (1pt), "Player Details — Transactions/Contract" (1pt), "Player Details — Injury/News" (1pt) from the Push category — 5pt total.

### US-21.1: Single-player details surface ✅ COMPLETED
**As a** drafter, **I want** to click any player and see their full picture in one panel, **so that** I'm not tab-switching mid-bid.

**Acceptance criteria:**
- New `PlayerDetailModal` opens on row click in any player table
- Sections rendered, top to bottom: identity (name, MLB team, positions, age — `dataAsOf`), projected stats (hitting + pitching where applicable), recent transactions list, depth-chart rank within team, injury status with date if non-active, attached note (US-20)
- Data sourced from `GET /api/v1/players/:playerId` on the Player Data API (Draft Kit proxies through `/draft-sessions/:id/players/:playerId` to keep the API key server-side)
- Loading + error states; close on Esc / overlay click

---

## Epic 22: Draft Day Sort, Move & Redo (Rubric: Draft Day)

> **Rubric mapping:** "Sorting Players List by $" (2pt), "Sorting Players List by Stats" (2pt), "Move player to new position" (2pt), "Undo/Redo for all draft Editing" — Redo half (1pt) — 7pt total.

### US-22.1: Sort the player list by $ value ✅ COMPLETED
**As a** drafter, **I want** the Players tab table sortable by projected $ value (asc/desc), **so that** I can scan high-value targets fast.

**Acceptance criteria:**
- Column headers "$ Value" and (when valuations load) "Surplus" are clickable; click toggles asc → desc → off
- Active sort indicator in the header
- Default sort: $ Value descending after valuations load

### US-22.2: Sort the player list by stats ✅ COMPLETED
**As a** drafter, **I want** to sort by HR, RBI, AVG, ERA, WHIP, K, etc., **so that** I can drill into category-specific scouting.

**Acceptance criteria:**
- Every numeric stat column header is clickable; same tri-state toggle as US-22.1
- Sort persists across position filter / search changes; clicking a different column resets to descending
- Empty/null stat values sort last regardless of direction

### US-22.3: Move a recorded purchase to a new position ✅ COMPLETED
**As a** drafter, **I want** to change the slot a purchased player occupies (e.g. an OF/UTIL eligible player from OF → UTIL), **so that** my filled slots reflect my actual lineup.

**Acceptance criteria:**
- Implementation reuses US-18.2 endpoint for active status
- Edit modal in the Draft History row exposes a "Position" dropdown alongside "Team" and "Price"

### US-22.4: Redo for all draft editing ✅ COMPLETED
**As a** drafter, **I want** a Redo affordance that re-applies the most recent undo, **so that** an accidental Undo click is one tap to recover from.

**Acceptance criteria:**
- Server tracks an `undoStack[]` per session — each undo pushes the reversed event onto it
- New endpoint `POST /draft-sessions/:id/redo` re-applies the top of the stack
- Any successful new mutation (record, undo, edit) clears the stack
- Header gains a "↻ Redo" icon; disabled when stack is empty
- Same applies symmetrically: edits and undos can be redone

---

## Epic 23: Fantasy Team Comparison (Rubric: Draft Day)

> **Rubric mapping:** "Fantasy Team Tabular Comparison" (2pt), "Fantasy Team Tabular Comparison — Sortable by Estimated Rankings/Money/etc." (2pt) — 4pt total.

### US-23.1: Side-by-side team comparison view ✅ COMPLETED
**As a** drafter, **I want** a single screen comparing every fantasy team across budget, slots filled, total spend, projected category totals, **so that** I can see who's winning the auction.

**Acceptance criteria:**
- New "Compare" tab in the draft room, distinct from the existing per-team Teams tab
- Table: rows = teams, columns = `Spent | Remaining | Slots | Projected HR | Projected SB | … | Total Projected $`
- Stat columns derived from each team's purchased players' projected stats (Player Data API `/valuations`)
- Updates live as purchases land

### US-23.2: Sortable comparison table ✅ COMPLETED
**As a** drafter, **I want** to sort the comparison by any column (rank, money, projected category total), **so that** I can see who leads in any single dimension.

**Acceptance criteria:**
- Every header is clickable; tri-state asc → desc → off
- Highlight my team's row regardless of sort
- Default sort: Total Projected $ descending

---

## Epic 24: MLB Depth Charts View (Rubric: Draft Day)

> **Rubric mapping:** "Can View MLB Team Depth Charts" (2pt) — 2pt.

### US-24.1: View MLB team depth charts ✅ COMPLETED
**As a** drafter, **I want** a screen showing every MLB team's depth chart (already ingested per Player Data API US-4.3), **so that** I can scout playing time without leaving the kit.

**Acceptance criteria:**
- New "MLB Depth" route accessible from the draft room nav
- Drop-down picks one of the 30 MLB teams; default = my team-of-interest from a per-user setting
- Lays out players grouped by `depthChartPosition` and ordered by `depthChartRank`
- Highlights players already on a fantasy team (with team name) and marks my team's holdings distinctly
- Data sourced from `GET /api/v1/players?team=<abbr>` filtered + sorted client-side

---

## Epic 25: Push Notification Client (Rubric: Player API → Draft Kit Push)

> **Rubric mapping:** "Draft Kit show updated pushed state" (2pt), "Draft Kit employs notification system to alert user of pushed state" (2pt) — 4pt total. (The Player Data API counterpart is its new Epic 13.)

### US-25.1: Receive and apply pushed updates ✅ COMPLETED
**As a** drafter, **I want** the kit to apply server-pushed updates (an injury just landed, a transaction happened) without me clicking refresh, **so that** my view is always current.

**Acceptance criteria:**
- Client subscribes to a Server-Sent Events stream `GET /draft-sessions/:id/events` (Draft Kit server proxies the Player Data API's push channel — see API US-13.2)
- Event types: `player.injury`, `player.transaction`, `player.depthChart`
- On event, the affected player's row in every visible table re-renders with the new status; the player detail panel updates if open
- Connection auto-reconnects with exponential backoff on disconnect

### US-25.2: Toast feed for pushed events ✅ COMPLETED
**As a** drafter, **I want** a non-blocking toast/notification when something newsworthy lands during my draft, **so that** I notice the change.

**Acceptance criteria:**
- Each pushed event renders a toast: "Aaron Judge → IL-10 (Hamstring)" / "Mookie Betts traded to LAD"
- Toasts auto-dismiss after 8 seconds; clicking opens the player detail panel
- Notification feed icon in the header opens a dismissible panel listing the last 50 events for the session
- User preference toggle (per-account) to mute toasts but keep the feed populated

---

## Epic 26: Taxi Draft (Rubric: Taxi Draft)

> **Rubric mapping:** all six rubric lines under "Taxi Draft" (10pt total).

> Taxi Draft = a separate, ordered draft for minor-league / supplemental rosters that runs after the main auction. Distinct from Epic 19 (entering existing minor league players); this is the *act of drafting* into those slots.

### US-26.1: Specify the taxi draft order ✅ COMPLETED
**Acceptance criteria:**
- `DraftSession.taxiDraftOrder: string[]` — array of `teamId` in pick order
- Setup screen Taxi tab exposes a drag-to-reorder list of teams; defaults to the team creation order
- Persisted via `PUT /draft-sessions/:id/taxi/order`

### US-26.2: Edit the taxi draft order before/during taxi ✅ COMPLETED
**Acceptance criteria:**
- Same endpoint accepts updated order at any time before the taxi draft enters `completed`
- UI confirms reorders that change "next pick" mid-round

### US-26.3: Enter players into taxi rosters in any order ✅ COMPLETED
**Acceptance criteria:**
- New `POST /draft-sessions/:id/taxi/picks` with `{ teamId, playerId }` records a taxi pick
- Picks don't have to follow `taxiDraftOrder` strictly — kit warns if out-of-order but allows the override (real-room flexibility)
- Picks debit the team's `minorLeaguePlayers[]` and increment a `taxiNominationOrder` counter

### US-26.4: Find players for taxi entry ✅ COMPLETED
**Acceptance criteria:**
- Taxi entry form has the same autocomplete as the main draft entry form (US-4.1)
- Suggestions filter to players NOT in any team's main or minor league roster
- Optional "Prospects only" toggle filters by `mlbStatus === 'minors'`

### US-26.5: Taxi-entered players are removed from main draft eligibility ✅ COMPLETED
**Acceptance criteria:**
- After a taxi pick, the player is added to `team.minorLeaguePlayers[]` and removed from the main draft's `availablePlayerIds` (per US-19.2 mechanics)
- Reversing a taxi pick restores availability

### US-26.6: Edit taxi rosters ✅ COMPLETED
**Acceptance criteria:**
- Each taxi pick has Undo + Edit (move to another team / replace player) actions
- Undo restores availability and decrements `taxiNominationOrder`

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
| **Rubric Parity (added from project rubric)** | | |
| Year-aware drafts | 15 | 3 |
| Account auth hardening | 16 | 2 |
| League configuration extensions | 17 | 3 |
| Pre-draft rosters & keepers | 18 | 4 |
| Minor league rosters | 19 | 3 |
| Player notes | 20 | 2 |
| Player details panel | 21 | 1 |
| Draft day sort/move/redo | 22 | 4 |
| Fantasy team comparison | 23 | 2 |
| MLB depth charts view | 24 | 1 |
| Push notification client | 25 | 2 |
| Taxi draft | 26 | 6 |
| **Total** | | **111** |
