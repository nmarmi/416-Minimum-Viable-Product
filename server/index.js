// Node APIs
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const cookieParser = require('cookie-parser')

// setup server
dotenv.config()
const PORT = process.env.PORT || 4000;
const app = express()
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// setup middleware
// there shouldnt be uploads >10mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(cors({
    origin: corsOrigins,
    credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

// setup routes as middleware
const authRouter = require('./routes/auth-router')
const leagueRouter = require('./routes/league-router')
const playersRouter = require('./routes/players-router')
app.use('/auth', authRouter)
app.use('/leagues', leagueRouter)
app.use('/players', playersRouter)

// init database
const db = require('./db');

(async () => {
    try {
        await db.init();
        console.log("db initialized");
        if (process.env.PLAYER_API_URL && process.env.PLAYER_API_KEY) {
            console.log("Player Data API: using", process.env.PLAYER_API_URL, "(pull + push)");
        }

        app.listen(PORT, () =>
            console.log(`DraftIQ Server running on port ${PORT}`)
        );
    } catch (err) {
        console.error("Failed to initialize database:", err);
    }
})();
