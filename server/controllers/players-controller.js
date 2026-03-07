const auth = require('../auth');
const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');

const getPlayers = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        const search = req.query.search || '';
        const team = req.query.team || '';
        const position = req.query.position || '';
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        if (licensedApi.hasConfig()) {
            const data = await licensedApi.getPlayers({ search, team, position, limit, offset });
            return res.status(200).json({
                success: true,
                players: data.players || [],
                total: data.total ?? (data.players || []).length
            });
        }

        const source = req.query.source || 'projection';
        const { list, total } = await db.getPlayers({
            search,
            team,
            position,
            source,
            limit,
            offset
        });

        return res.status(200).json({
            success: true,
            players: list,
            total
        });
    } catch (err) {
        console.error("getPlayers error:", err);
        const message = licensedApi.hasConfig()
            ? `Player Data API error: ${err.message}. Is the API running at ${process.env.PLAYER_API_URL}?`
            : "Unable to load players.";
        return res.status(500).json({
            success: false,
            errorMessage: message
        });
    }
};

const postUsage = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        if (!licensedApi.hasConfig()) {
            return res.status(200).json({ success: true, message: "Licensed API not configured; usage not sent." });
        }

        const { event, timestamp, metadata } = req.body || {};
        await licensedApi.postUsage({
            event: event || 'draft_room_open',
            timestamp: timestamp || new Date().toISOString(),
            metadata: metadata || {}
        });

        return res.status(200).json({ success: true, message: "Usage recorded." });
    } catch (err) {
        console.error("postUsage error:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Failed to send usage to licensed API."
        });
    }
};

module.exports = {
    getPlayers,
    postUsage
};
