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

        // US-15.2: enrich each league with its draft session's seasonYear so the
        // home screen can group and filter without a separate per-league request.
        const enriched = await Promise.all(leagues.map(async (league) => {
            const plain = typeof league.toObject === 'function' ? league.toObject() : { ...league };
            if (plain.draftSessionId) {
                try {
                    const session = await db.getDraftSessionById(plain.draftSessionId);
                    plain.seasonYear = session?.leagueSettings?.seasonYear ?? new Date().getFullYear();
                    plain.draftStatus = session?.status ?? 'setup';
                } catch (_) {
                    plain.seasonYear = new Date().getFullYear();
                }
            } else {
                plain.seasonYear = new Date().getFullYear();
            }
            return plain;
        }));

        return res.status(200).json({ success: true, leagues: enriched });
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

// US-15.3: Clone a prior-year draft into a fresh league for a new season
const cloneLeague = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const sourceLeague = await db.getLeagueById(req.params.leagueId);
        if (!sourceLeague) return res.status(404).json({ success: false, errorMessage: 'Source league not found.' });
        if (String(sourceLeague.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can clone it.' });
        }

        const { targetYear } = req.body;
        const cloneYear = Number.isInteger(Number(targetYear)) && Number(targetYear) >= 2000
            ? Number(targetYear)
            : new Date().getFullYear();

        // Load source draft session to carry settings over
        const sourceDraft = sourceLeague.draftSessionId
            ? await db.getDraftSessionById(sourceLeague.draftSessionId)
            : null;

        const sourceSettings = sourceDraft?.leagueSettings
            ? (typeof sourceDraft.leagueSettings.toObject === 'function'
                ? sourceDraft.leagueSettings.toObject()
                : sourceDraft.leagueSettings)
            : {};

        const clonedSettings = sanitizeLeagueSettings({
            ...sourceSettings,
            seasonYear: cloneYear
        });

        // Clone team names but reset budgets and rosters
        const clonedTeams = sourceDraft?.teams?.length
            ? sourceDraft.teams.map((t) => ({
                teamId:          t.teamId,
                teamName:        t.teamName,
                budgetRemaining: clonedSettings.salaryCap,
                purchasedPlayers: [],
                filledRosterSlots: new Map(Object.keys(Object.fromEntries(clonedSettings.rosterSlots instanceof Map ? clonedSettings.rosterSlots : new Map(Object.entries(clonedSettings.rosterSlots || {})))).map((k) => [k, 0])),
            }))
            : buildTeams(clonedSettings.numberOfTeams, clonedSettings.salaryCap, clonedSettings.rosterSlots);

        const clonedLeagueName = `${sourceLeague.name} (${cloneYear})`;
        const clonedLeague = await db.createLeague(userId, { name: clonedLeagueName });

        const clonedSession = await db.createDraftSession({
            draftSessionId: generateDraftSessionId(),
            leagueId:       clonedLeague._id,
            createdBy:      userId,
            leagueSettings: clonedSettings,
            teams:          clonedTeams,
            availablePlayerIds: []
        });

        await db.setLeagueDraftSession(clonedLeague._id, clonedSession.draftSessionId);

        return res.status(201).json({
            success: true,
            league:       clonedLeague,
            draftSession: serializeSession(clonedSession)
        });
    } catch (err) {
        console.error('cloneLeague error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to clone league right now.' });
    }
};

module.exports = { createLeague, getMyLeagues, deleteLeague, cloneLeague };
