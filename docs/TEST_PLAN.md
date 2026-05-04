# DraftIQ — Test Plan

---

## 1. Overview

This document describes the testing strategy for the DraftIQ application and the test suite that has been implemented.

The application has two independently testable layers:

- **Server** — Node.js/Express REST API backed by MongoDB
- **Client** — React single-page application

**Total tests: 60 (41 server + 19 client) — all passing.**

---

## 2. Running the Tests

```bash
# Server (Vitest — 41 tests)
cd server && npm test

# Client (Jest/React Testing Library — 19 tests)
cd client && CI=true npm test -- --watchAll=false
```

The server tests start their own in-memory MongoDB instance and require no external services.

---

## 3. Tools

### Server

| Tool | Purpose |
|---|---|
| **Vitest** | Test runner and assertion library (`vitest ^3.2.4`) |
| **mongodb-memory-server** | In-memory MongoDB for db-layer and service tests — no real database required |
| **supertest** | Sends real HTTP requests to the Express app without binding to a port |

### Client

| Tool | Purpose |
|---|---|
| **Jest + React Scripts** | Default test runner bundled with Create React App |
| **React Testing Library** | Renders components into jsdom; queries by accessible roles and text |
| **jest.fn() mocks** | All HTTP requests are intercepted by mocking the request-sender modules |

---

## 4. Directory Layout

```
server/
  vitest.config.js                  ← globals: true, environment: node, testTimeout: 20s
  test/
    helpers/
      createApp.js                  ← Express app factory for supertest (no DB init)
    auth.test.js                    ← POST /auth/register, /login, /logout, GET /auth/loggedIn
    league.test.js                  ← POST /leagues, GET /leagues, DELETE /leagues/:id
    draft-service.test.js           ← recordPurchase, undoPurchase, editPurchase logic
    db.test.js                      ← MongoDBManager CRUD for users and leagues

client/
  src/
    setupTests.js                   ← jest-dom matchers + global fetch mock
    test/
      testUtils.js                  ← renderWithProviders helper with mock Auth + Store contexts
      auth.test.js                  ← AuthContext: mount, login, logout state transitions
      store.test.js                 ← GlobalStore: loadLeagues, createLeague, deleteLeague
      LoginScreen.test.js           ← render, form submit, error modal
      PlayerHomeScreen.test.js      ← mount, empty state, league list, create modal, validation
```

---

## 5. Server Test Suites

### `test/auth.test.js` (12 tests)

Tests every `/auth` route via supertest with the db singleton mocked using `vi.spyOn()`.

| Endpoint | Cases |
|---|---|
| `POST /auth/register` | success (201 + cookie); missing fields → 400; password < 8 chars → 400; passwords mismatch → 400; duplicate email → 400 |
| `POST /auth/login` | success (200 + cookie); wrong password → 401; user not found → 401; missing fields → 400 |
| `GET /auth/logout` | clears token cookie |
| `GET /auth/loggedIn` | no cookie → `loggedIn: false`; valid JWT cookie → `loggedIn: true` with user |

### `test/league.test.js` (11 tests)

Tests every `/leagues` route via supertest with the db singleton mocked. Auth is exercised using real JWTs signed by `auth.signToken()`.

| Endpoint | Cases |
|---|---|
| `POST /leagues` | unauthenticated → 401; empty name → 400; missing name → 400; success → 201 |
| `GET /leagues` | unauthenticated → 401; success → 200 with array |
| `DELETE /leagues/:id` | unauthenticated → 401; not found → 404; non-owner → 403; success → 200; also deletes associated draft session |

### `test/draft-service.test.js` (10 tests)

Tests the draft service business logic against a real in-memory MongoDB. No HTTP layer involved.

| Function | Cases |
|---|---|
| `recordPurchase` | success (player moves, budget debited, history appended); player not in pool → failure; price exceeds maxBid → failure; roster full → failure; draft not active → failure |
| `undoPurchase` | success (availability restored, budget refunded); purchase not found → failure |
| `editPurchase` | price change updates budget and history; price = 0 → failure |

### `test/db.test.js` (8 tests)

Tests the `MongoDBManager` class directly against an in-memory MongoDB instance started via `mongodb-memory-server`.

| Domain | Cases |
|---|---|
| Users | `createUser` + `getUserByEmail`; `createUser` + `getUserById`; unknown email → null; `deleteUser`; `updateUser` |
| Leagues | `createLeague` + `getLeaguesForUser`; `getLeagueById`; `deleteLeagueById`; user isolation (only own leagues returned) |

---

## 6. Client Test Suites

All client tests use a custom `renderWithProviders()` helper (from `src/test/testUtils.js`) that wraps components with `MemoryRouter`, a mock `AuthContext.Provider`, and a mock `GlobalStoreContext.Provider`. HTTP calls are mocked via `jest.mock()` on the request-sender modules.

### `test/auth.test.js` (5 tests)

Renders `AuthContextProvider` with the `./requests` module mocked. Tests state transitions via a test consumer component.

- Mount: `getLoggedIn()` called; not logged in
- Mount: `getLoggedIn()` returns active session → `loggedIn: true`
- `loginUser` success → `loggedIn: true`, user populated
- `loginUser` failure → `errorMessage` set, `loggedIn` stays false
- `logoutUser` success → `loggedIn: false`, user cleared

### `test/store.test.js` (4 tests)

Renders `GlobalStoreContextProvider` with `../leagues/requests` and `../draft-sessions/requests` mocked.

- `loadLeagues` success → `store.leagues` populated
- `loadLeagues` failure → `store.leagues` stays empty
- `createLeague` → league added to store
- `deleteLeague` → league removed from store

### `test/LoginScreen.test.js` (4 tests)

- Renders email/password inputs and submit button
- Form submit calls `auth.loginUser` with correct args
- Error modal hidden when `errorMessage` is null
- Error modal visible when `errorMessage` is set

### `test/PlayerHomeScreen.test.js` (6 tests)

- `store.loadLeagues` called on mount
- Empty state renders when leagues array is empty
- League cards render for each league in the store
- "Create League" button opens create modal
- Empty name in modal shows validation error
- Valid name calls `store.createLeague` with trimmed value

---

## 7. Mocking Strategy

### Server

Controller tests (`auth.test.js`, `league.test.js`) mock the `db` singleton by replacing its methods with `vi.spyOn()` before each request. This works because the db module is a cached singleton — controllers hold a reference to the same object.

Authentication is exercised with real JWTs: `auth.signToken(userId)` generates a valid token which is passed as a `token` cookie to authenticated requests. No mocking of the auth module is needed.

Service and db tests (`draft-service.test.js`, `db.test.js`) use a real Mongoose connection to a `MongoMemoryServer` instance started in `beforeAll`.

### Client

The `renderWithProviders` helper injects mock context values directly into `AuthContext.Provider` and `GlobalStoreContext.Provider`, bypassing the real provider setup logic entirely. This avoids side effects from `useEffect` calls in the providers (e.g., `getLoggedIn()` on mount).

For `auth.test.js` and `store.test.js`, where the real provider IS rendered, the underlying HTTP request modules are mocked at the module level using `jest.mock()`.

---

## 8. CI Integration

Tests run automatically via GitHub Actions (`.github/workflows/auto-testing.yml`) on every push and pull request to `main`. The deploy workflow (`.github/workflows/deploy.yml`) only triggers if all tests pass.

---

## 9. What Is Not Tested

The following are explicitly out of scope:

- **`DraftRoomScreen`** — this component is 927 lines and is a candidate for future refactoring before being tested
- **End-to-end (E2E) browser tests** — no Playwright or Cypress setup is planned at this stage
- **External Player Data API** — the licensed third-party API is not mocked; `postUsage` returns a no-op when unconfigured
- **CSS / visual regression** — no snapshot or visual diff tooling is planned
