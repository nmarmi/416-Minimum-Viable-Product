# Draft Kit → Player Data API Contract

This document records the exact field mappings between `DraftSession` Mongoose
documents and the payloads sent to the Player Data API. When the API contract
changes, update `server/lib/player-api-adapter.js` and this file together.

> The canonical OpenAPI spec lives in the Player Data API repo at
> `docs/openapi.yaml`. That spec is the cross-repo source of truth for schema
> drift per US-11.1.

---

## Endpoints called by the Draft Kit

| Method | Path | Controller | Helper |
|--------|------|------------|--------|
| `GET` | `/api/v1/players` | `getSessionPlayers` | — |
| `GET` | `/api/v1/players/:id` | — | `getPlayerById` alias |
| `GET` | `/api/v1/players/pool` | `startDraftSession` | `fetchPoolPlayerIds` |
| `POST` | `/players/valuations` ¹ | `getSessionValuations` | `postValuations` |
| `POST` | `/api/v1/players/recommendations` | `getSessionRecommendations` | `postRecommendations` |
| `POST` | `/api/v1/players/recommendations/nominations` | — | `postNominations` |
| `POST` | `/api/v1/usage` | various | `postUsage` |

¹ Tries `/api/v1/players/valuations` first, falls back to `/players/valuations`
while the Player Data API completes its versioned route migration. Set
`PLAYER_API_LEGACY=1` to skip straight to the unversioned path.

---

## `leagueSettings` payload

Built by `toPlayerApiLeagueSettings(session.leagueSettings, { forValuations })` in
`server/lib/player-api-adapter.js`.

### For valuations (`forValuations: true`)

| API field | Source field | Notes |
|-----------|-------------|-------|
| `numTeams` | `leagueSettings.numberOfTeams` | Defaults to `12` |
| `budget` | `leagueSettings.salaryCap` | Defaults to `260` |
| `hitterBudgetPct` | — | Hardcoded `0.675` |
| `hitterSlotsPerTeam` | `leagueSettings.rosterSlots` | Sum of non-pitcher, non-bench slots (C, 1B, 2B, 3B, SS, OF, UTIL, …) |
| `pitcherSlotsPerTeam` | `leagueSettings.rosterSlots` | Sum of SP + RP + P slots |
| `statSeason` | — | `new Date().getFullYear()` |

Bench slots (`BENCH`, `BN`) are excluded from both counts.

### For recommendations (`forValuations: false`)

| API field | Source field | Notes |
|-----------|-------------|-------|
| `budget` | `leagueSettings.salaryCap` | Defaults to `260` |
| `rosterSlots` | `leagueSettings.rosterSlots` | Total slot count (all positions including bench) |

---

## `draftState` payload

Built by `toPlayerApiDraftState(session)` in `server/lib/player-api-adapter.js`.
The same full shape is sent to both `/valuations` and `/recommendations/nominations`.
The `/recommendations` endpoint currently only uses `availablePlayerIds`.

| API field | Source | Notes |
|-----------|--------|-------|
| `availablePlayerIds` | `session.availablePlayerIds` | Player IDs not yet drafted |
| `purchasedPlayers[].playerId` | `session.draftHistory[].playerId` | — |
| `purchasedPlayers[].teamId` | `session.draftHistory[].teamId` | `fantasy-team-{n}` format |
| `purchasedPlayers[].price` | `session.draftHistory[].price` | Dollar amount paid at auction |
| `purchasedPlayers[].positionFilled` | `session.draftHistory[].positionFilled` | Roster slot used, or `null` |
| `teamBudgets` | `session.teams[].budgetRemaining` | Keyed by `teamId` |
| `filledRosterSlots` | `session.teams[].filledRosterSlots` | Keyed by `teamId`, value is `{ position: count }` |

`purchasedPlayers` is built from `draftHistory[]` (not `teams[].purchasedPlayers[]`)
because only `draftHistory` carries `teamId` and `positionFilled`.

---

## Environment variables

| Variable | Effect |
|----------|--------|
| `PLAYER_API_URL` | Base URL for the Player Data API. Required for live data. |
| `PLAYER_API_KEY` | API key sent as `X-API-Key` and `Authorization: Bearer`. Required for live data. |
| `PLAYER_API_LEGACY=1` | Use unversioned paths (`/players`, `/players/valuations`) for testing against older API builds. |

When `PLAYER_API_URL` is not set, all client methods return `null` and the Draft
Kit falls back to MongoDB projections or returns empty arrays.

---

## Error shape

The Player Data API returns errors in this shape:

```json
{ "success": false, "error": "Human-readable message", "code": "MACHINE_CODE", "fields": [] }
```

`server/lib/licensed-player-api.js` converts these to `PlayerDataApiError` instances
with `.code`, `.fields`, and `.status`. Controllers that catch a `PlayerDataApiError`
forward `errorCode` and `fieldErrors` alongside `errorMessage` in the response body.
