const auth = require('../auth');
const db = require('../db');
const {
    DEFAULT_NUM_TEAMS,
    DEFAULT_SALARY_CAP,
    DEFAULT_ROSTER_SLOTS,
    DEFAULT_SCORING_TYPE,
    generateDraftSessionId,
    sanitizeLeagueSettings,
    buildTeams,
    serializeSession
} = require('../services/draft-defaults');

const createLeague = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { name } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, errorMessage: 'League name is required.' });
        }

        const league = await db.createLeague(userId, { name: name.trim() });

        const leagueSettings = sanitizeLeagueSettings({
            numberOfTeams: DEFAULT_NUM_TEAMS,
            salaryCap: DEFAULT_SALARY_CAP,
            rosterSlots: DEFAULT_ROSTER_SLOTS,
            scoringType: DEFAULT_SCORING_TYPE
        });

        const session = await db.createDraftSession({
            draftSessionId: generateDraftSessionId(),
            leagueId: league._id,
            createdBy: userId,
            leagueSettings,
            teams: buildTeams(leagueSettings.numberOfTeams, leagueSettings.salaryCap, leagueSettings.rosterSlots),
            availablePlayerIds: []
        });

        await db.setLeagueDraftSession(league._id, session.draftSessionId);

        return res.status(201).json({
            success: true,
            league,
            draftSession: serializeSession(session)
        });
    } catch (err) {
        console.error('createLeague error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to create league right now.' });
    }
};

const getMyLeagues = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const leagues = await db.getLeaguesForUser(userId);

        return res.status(200).json({ success: true, leagues });
    } catch (err) {
        console.error('getMyLeagues error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to load leagues right now.' });
    }
};

const deleteLeague = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const league = await db.getLeagueById(req.params.leagueId);
        if (!league) {
            return res.status(404).json({ success: false, errorMessage: 'League not found.' });
        }
        if (String(league.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can delete this league.' });
        }

        if (league.draftSessionId) {
            await db.deleteDraftSessionBySessionId(league.draftSessionId);
        }
        await db.deleteLeagueById(league._id);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('deleteLeague error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to delete league right now.' });
    }
};

module.exports = { createLeague, getMyLeagues, deleteLeague };
