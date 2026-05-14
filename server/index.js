const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');
const cookieParser = require('cookie-parser');

dotenv.config();

const PORT = process.env.PORT || 4000;
const app  = express();
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const authRouter         = require('./routes/auth-router');
const leagueRouter       = require('./routes/league-router');
const playersRouter      = require('./routes/players-router');
const draftSessionRouter = require('./routes/draft-session-router');

app.use('/auth',           authRouter);
app.use('/leagues',        leagueRouter);
app.use('/players',        playersRouter);
app.use('/draft-sessions', draftSessionRouter);

const db = require('./db');

(async () => {
    try {
        await db.init();
        const playerApiConfigured = Boolean(process.env.PLAYER_API_URL && process.env.PLAYER_API_KEY);
        app.listen(PORT, () => {
            console.info(`[draftiq-server] listening on port ${PORT}`);
            console.info(`[draftiq-server] player data API: ${playerApiConfigured ? process.env.PLAYER_API_URL : 'MongoDB fallback'}`);
            console.info(`[draftiq-server] env: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (err) {
        console.error('[draftiq-server] failed to initialise database:', err.message);
        process.exit(1);
    }
})();
