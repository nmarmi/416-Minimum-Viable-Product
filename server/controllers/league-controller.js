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

        const {
            name,
            inviteCode,
            seasonYear,
            numberOfTeams,
            draftType,
            leagueMode
        } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                errorMessage: "League name is required."
            });
        }

        if (!seasonYear) {
            return res.status(400).json({
                success: false,
                errorMessage: "Season year is required."
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
            inviteCode: inviteCode && String(inviteCode).trim() ? String(inviteCode).trim().toUpperCase() : undefined,
            seasonYear,
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

const joinLeague = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        const { inviteCode } = req.body;
        if (!inviteCode || !String(inviteCode).trim()) {
            return res.status(400).json({
                success: false,
                errorMessage: "Invite code is required."
            });
        }

        const result = await db.joinLeagueByInviteCode(userId, inviteCode);
        if (!result.ok) {
            return res.status(result.status || 400).json({
                success: false,
                errorMessage: result.errorMessage || "Unable to join league."
            });
        }

        return res.status(200).json({
            success: true,
            league: result.league
        });
    } catch (err) {
        console.error("joinLeague error:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Unable to join league right now."
        });
    }
};

module.exports = {
    createLeague,
    getMyLeagues,
    joinLeague
};
