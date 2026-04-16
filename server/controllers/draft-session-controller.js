const mongoose = require('mongoose');
const auth = require('../auth');
const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');
const DraftSession = require('../models/draft-session-model');
const draftService = require('../services/draft-service');

const DEFAULT_NUM_TEAMS = 12;
const DEFAULT_SCORING_TYPE = '5x5 Roto';
const DEFAULT_DRAFT_TYPE = 'AUCTION';
const DEFAULT_SALARY_CAP = 260;
const DEFAULT_ROSTER_SLOTS = {
    C: 2,
    '1B': 1,
    '2B': 1,
    '3B': 1,
    SS: 1,
    OF: 5,
    UTIL: 1,
    SP: 5,
    RP: 3,
    BENCH: 4
};
const SCORING_TYPES = ['5x5 Roto', 'H2H Categories', 'Points'];

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toPlainObject(value) {
    if (!value) return {};
    if (value instanceof Map) {
        return Object.fromEntries(value.entries());
    }
    if (typeof value.toObject === 'function') {
        return value.toObject();
    }
    return value;
}

function buildFilledRosterSlots(rosterSlots = {}) {
    const resolvedRosterSlots = toPlainObject(rosterSlots);
    return Object.keys(resolvedRosterSlots).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

function buildTeams(numberOfTeams, salaryCap, rosterSlots, existingTeams = []) {
    const totalTeams = Math.min(Math.max(toPositiveInt(numberOfTeams, DEFAULT_NUM_TEAMS), 2), 30);
    const resolvedSalaryCap = Math.max(toPositiveInt(salaryCap, DEFAULT_SALARY_CAP), 1);

    return Array.from({ length: totalTeams }, (_, index) => {
        const teamId = `fantasy-team-${index + 1}`;
        const existingTeam = existingTeams.find((team) => team.teamId === teamId);
        const existingName = existingTeam?.teamName && String(existingTeam.teamName).trim();

        return {
            teamId,
            teamName: existingName || teamId,
            budgetRemaining: resolvedSalaryCap,
            purchasedPlayers: Array.isArray(existingTeam?.purchasedPlayers) ? existingTeam.purchasedPlayers : [],
            filledRosterSlots: buildFilledRosterSlots(rosterSlots)
        };
    });
}

function sanitizeRosterSlots(input = {}) {
    const resolvedInput = toPlainObject(input);
    const rosterSlots = {};

    Object.keys(DEFAULT_ROSTER_SLOTS).forEach((slot) => {
        rosterSlots[slot] = Math.max(Number.parseInt(resolvedInput[slot], 10) || 0, 0);
    });

    return rosterSlots;
}

function sanitizeLeagueSettings(input = {}, fallback = {}) {
    const resolvedInput = toPlainObject(input);
    const resolvedFallback = toPlainObject(fallback);
    const rosterSlots = sanitizeRosterSlots(resolvedInput.rosterSlots || resolvedFallback.rosterSlots || DEFAULT_ROSTER_SLOTS);
    const scoringType = SCORING_TYPES.includes(resolvedInput.scoringType) ? resolvedInput.scoringType : (resolvedFallback.scoringType || DEFAULT_SCORING_TYPE);

    return {
        numberOfTeams: Math.min(Math.max(toPositiveInt(resolvedInput.numberOfTeams, resolvedFallback.numberOfTeams || DEFAULT_NUM_TEAMS), 2), 30),
        salaryCap: Math.max(toPositiveInt(resolvedInput.salaryCap, resolvedFallback.salaryCap || DEFAULT_SALARY_CAP), 1),
        rosterSlots,
        scoringType,
        draftType: DEFAULT_DRAFT_TYPE
    };
}

function generateDraftSessionId() {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getLeagueForUser(leagueId, userId) {
    if (!mongoose.Types.ObjectId.isValid(leagueId)) {
        return null;
    }

    const league = await db.getLeagueById(leagueId);
    if (!league) {
        return null;
    }

    const isOwner = String(league.owner) === String(userId);

    if (!isOwner) {
        return null;
    }

    return league;
}

async function getAvailablePlayerIds() {
    if (!licensedApi.hasConfig()) {
        return await db.getAvailablePlayerIds({ source: 'projection' });
    }

    const collected = [];
    const seen = new Set();
    const pageSize = 1000;
    let offset = 0;
    let total = null;

    do {
        const data = await licensedApi.getPlayers({ limit: pageSize, offset });
        const players = data?.players || [];

        players.forEach((player) => {
            const playerId = String(
                player.id ||
                player._id ||
                player.playerId ||
                `${player.playerName || player.name || 'player'}-${player.team || player.mlbTeam || 'team'}`
            );

            if (!seen.has(playerId)) {
                seen.add(playerId);
                collected.push(playerId);
            }
        });

        total = Number.isFinite(data?.total) ? data.total : null;
        offset += players.length;

        if (players.length === 0) {
            break;
        }
    } while (total == null ? true : offset < total);

    return collected;
}

function serializeSession(session) {
    if (!session) return null;
    const plainSession = typeof session.toObject === 'function' ? session.toObject() : session;

    return {
        draftSessionId: plainSession.draftSessionId,
        leagueId: String(plainSession.leagueId),
        createdAt: plainSession.createdAt,
        updatedAt: plainSession.updatedAt,
        leagueSettings: {
            ...plainSession.leagueSettings,
            rosterSlots: toPlainObject(plainSession.leagueSettings?.rosterSlots)
        },
        teams: (plainSession.teams || []).map((team) => ({
            ...team,
            filledRosterSlots: toPlainObject(team.filledRosterSlots)
        })),
        availablePlayerIds: plainSession.availablePlayerIds || [],
        draftHistory: (plainSession.draftHistory || []).map((entry) => ({
            _id: String(entry._id),
            playerId: entry.playerId,
            playerName: entry.playerName,
            teamId: entry.teamId,
            price: entry.price,
            timestamp: entry.timestamp,
            nominationOrder: entry.nominationOrder,
        })),
    };
}

const createDraftSession = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { leagueId } = req.body || {};

        const league = await getLeagueForUser(leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can create a draft session.' });
        }

        if (league.draftSessionId) {
            const existing = await db.getDraftSessionById(league.draftSessionId);
            if (existing) {
                return res.status(200).json({
                    success: true,
                    draftSession: serializeSession(existing)
                });
            }
        }

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
            draftSession: serializeSession(session)
        });
    } catch (err) {
        console.error('createDraftSession error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to create draft session right now.' });
    }
};

const getDraftSession = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const session = await DraftSession.findOne({ draftSessionId: req.params.draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        if (!session.availablePlayerIds || session.availablePlayerIds.length === 0) {
            session.availablePlayerIds = await getAvailablePlayerIds();
            await db.saveDraftSession(session);
        }

        return res.status(200).json({
            success: true,
            draftSession: serializeSession(session)
        });
    } catch (err) {
        console.error('getDraftSession error:', err);
        const message = licensedApi.hasConfig()
            ? `Unable to load draft session from the Player Data API: ${err.message}`
            : 'Unable to load draft session right now.';
        return res.status(500).json({ success: false, errorMessage: message });
    }
};

const updateDraftSession = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const session = await DraftSession.findOne({ draftSessionId: req.params.draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can update this draft session.' });
        }

        const nextSettings = sanitizeLeagueSettings(req.body?.leagueSettings || {}, session.leagueSettings);
        const incomingTeams = Array.isArray(req.body?.teams) ? req.body.teams : session.teams;
        const nextTeams = buildTeams(nextSettings.numberOfTeams, nextSettings.salaryCap, nextSettings.rosterSlots, incomingTeams);

        session.leagueSettings = nextSettings;
        session.teams = nextTeams;

        await db.saveDraftSession(session);

        return res.status(200).json({
            success: true,
            draftSession: serializeSession(session)
        });
    } catch (err) {
        console.error('updateDraftSession error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to update draft session right now.' });
    }
};

const recordPurchase = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { draftSessionId } = req.params;
        const { playerId, playerName, teamId, price } = req.body || {};

        if (!playerId || !teamId || price == null) {
            return res.status(400).json({ success: false, errorMessage: 'playerId, teamId, and price are required.' });
        }

        const parsedPrice = Number(price);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 1) {
            return res.status(400).json({ success: false, errorMessage: 'price must be a positive number.' });
        }

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const result = await draftService.recordPurchase(draftSessionId, { playerId, playerName, teamId, price: parsedPrice });
        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        }

        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('recordPurchase error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to record purchase.' });
    }
};

module.exports = {
    createDraftSession,
    getDraftSession,
    updateDraftSession,
    recordPurchase,
};
