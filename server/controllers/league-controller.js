const auth = require('../auth');
const db = require('../db');

const createLeague = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        const { name, numberOfTeams, draftType, leagueMode } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                errorMessage: "League name is required."
            });
        }

        if (!numberOfTeams || Number(numberOfTeams) < 2) {
            return res.status(400).json({
                success: false,
                errorMessage: "Number of teams must be at least 2."
            });
        }

        const league = await db.createLeague(userId, {
            name: name.trim(),
            numberOfTeams,
            draftType,
            leagueMode
        });

        return res.status(201).json({
            success: true,
            league
        });
    } catch (err) {
        console.error("createLeague error:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Unable to create league right now."
        });
    }
};

const getMyLeagues = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        const leagues = await db.getLeaguesForUser(userId);

        return res.status(200).json({
            success: true,
            leagues
        });
    } catch (err) {
        console.error("getMyLeagues error:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Unable to load leagues right now."
        });
    }
};

module.exports = {
    createLeague,
    getMyLeagues
};
