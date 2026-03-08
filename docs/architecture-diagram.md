# DraftIQ Architecture Diagram

## 1) System Context

```mermaid
flowchart LR
    U["User Browser"]
    FE["React Frontend<br/>client (Vercel)"]
    BE["Node.js + Express API<br/>server (Render)"]
    DB[("MongoDB Atlas<br/>Users, Leagues, Players")]
    API[("Licensed Player Data API<br/>Optional: PLAYER_API_URL + PLAYER_API_KEY")]
    CSV["projections-NL.csv"]
    IMP["Import Script<br/>server/scripts/import-projections.js"]

    U -->|Loads UI + actions| FE
    FE -->|/auth, /leagues, /players<br/>credentials: include| BE
    BE -->|Mongoose queries| DB

    IMP -->|parses CSV and writes source=projection| DB
    CSV --> IMP

    BE -. Optional pull/push .-> API
    API -. GET /players, POST /usage .-> BE
```

## 2) Backend Layers

```mermaid
flowchart TB
    subgraph Client
      C1[Auth Requests]
      C2[Leagues Requests]
      C3[Players Requests]
    end

    subgraph Server[Express Server]
      R1[/auth router/]
      R2[/leagues router/]
      R3[/players router/]

      AC[auth-controller]
      LC[league-controller]
      PC[players-controller]

      AU[auth module\nJWT cookie verify/sign]
      DBI[db/index.js]
      MDB[MongoDBManager]
      LAPI[licensed-player-api client]
    end

    subgraph Data
      M1[(User model)]
      M2[(League model)]
      M3[(Player model)]
      EXT[(Licensed API)]
    end

    C1 --> R1 --> AC
    C2 --> R2 --> LC
    C3 --> R3 --> PC

    AC --> AU
    LC --> AU
    PC --> AU

    AC --> DBI --> MDB
    LC --> DBI
    PC --> DBI

    MDB --> M1
    MDB --> M2
    MDB --> M3

    PC -. if PLAYER_API_URL + PLAYER_API_KEY .-> LAPI --> EXT
```

## 3) Runtime Request Flow (Draft Room)

```mermaid
sequenceDiagram
    participant B as Browser (DraftRoomScreen)
    participant F as Frontend Requests Module
    participant S as Express /players
    participant A as Auth (JWT cookie)
    participant D as MongoDB
    participant X as Licensed API (optional)

    B->>F: getPlayers({search,limit})
    F->>S: GET /players?search=... (credentials: include)
    S->>A: verifyUser(req.cookies.token)

    alt licensed API configured
      S->>X: GET /players
      X-->>S: players,total
      S-->>F: success + players,total
    else fallback to MongoDB
      S->>D: query Player collection
      D-->>S: list,total
      S-->>F: success + players,total
    end

    B->>F: postUsage({event:"draft_room_open"})
    F->>S: POST /players/usage
    S->>A: verifyUser(token)

    alt licensed API configured
      S->>X: POST /usage
      X-->>S: success
      S-->>F: Usage recorded
    else no licensed API
      S-->>F: success (no-op)
    end
```

## Notes

- Auth is cookie-based JWT (`token` cookie, `credentials: include` from frontend).
- Primary backend endpoints: `/auth`, `/leagues`, `/players`.
- Player source is either local MongoDB (`Player` model) or external licensed API depending on env vars.
