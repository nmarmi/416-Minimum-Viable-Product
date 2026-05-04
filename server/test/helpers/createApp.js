const express = require('express');
const cookieParser = require('cookie-parser');

// Creates a minimal Express app for supertest — no DB init or listen call.
function createApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', require('../../routes/auth-router'));
    app.use('/leagues', require('../../routes/league-router'));
    app.use('/draft-sessions', require('../../routes/draft-session-router'));
    return app;
}

module.exports = createApp;
