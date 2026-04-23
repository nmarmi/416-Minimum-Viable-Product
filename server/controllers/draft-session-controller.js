const mongoose = require('mongoose');
const auth = require('../auth');
const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');
const DraftSession = require('../models/draft-session-model');
const draftService = require('../services/draft-service');
const {
    fetchPoolPlayerIds,
    toPlayerStub,
    PlayerPoolUnavailableError
} = require('../services/player-pool-service');

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

function normalizePurchasedPlayers(purchasedPlayers) {
    if (!Array.isArray(purchasedPlayers)) return [];
    return purchasedPlayers
        .map((entry) => {
            if (!entry) return null;
            if (typeof entry === 'string') return { playerId: entry, price: 0 };
            if (entry.playerId) {
                return {
                    playerId: String(entry.playerId),
                    price: Number.isFinite(Number(entry.price)) ? Number(entry.price) : 0
                };
            }
            return null;
        })
        .filter(Boolean);
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
            purchasedPlayers: normalizePurchasedPlayers(existingTeam?.purchasedPlayers),
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

/**
 * US-3.2: Pull the current player pool from the Player Data API and
 * return the IDs that should populate `DraftSession.availablePlayerIds`.
 * This replaces the old paginated `/players` scrape with a single
 * `/api/v1/players/pool` call. Upstream failures surface as
 * `PlayerPoolUnavailableError` so callers can reply with 503.
 */
async function loadPoolPlayerIds() {
    const { playerIds, pooledAt } = await fetchPoolPlayerIds();
    return { playerIds, pooledAt };
}

function serializeSession(session) {
    if (!session) return null;
    const plainSession = typeof session.toObject === 'function' ? session.toObject() : session;

    const purchasedPlayerIds = plainSession.purchasedPlayerIds && plainSession.purchasedPlayerIds.length > 0
        ? plainSession.purchasedPlayerIds
        : (plainSession.draftHistory || []).map((entry) => entry.playerId);

    return {
        draftSessionId: plainSession.draftSessionId,
        name: plainSession.name || '',
        status: plainSession.status || 'setup',
        myTeamId: plainSession.myTeamId || null,
        nominationOrder: plainSession.nominationOrder || 0,
        leagueId: String(plainSession.leagueId),
        createdAt: plainSession.createdAt,
        updatedAt: plainSession.updatedAt,
        pooledAt: plainSession.pooledAt || null,
        leagueSettings: {
            ...plainSession.leagueSettings,
            rosterSlots: toPlainObject(plainSession.leagueSettings?.rosterSlots)
        },
        teams: (plainSession.teams || []).map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            budgetRemaining: team.budgetRemaining,
            purchasedPlayers: (team.purchasedPlayers || []).map((p) => ({
                playerId: p.playerId,
                price: p.price
            })),
            filledRosterSlots: toPlainObject(team.filledRosterSlots)
        })),
        availablePlayerIds: plainSession.availablePlayerIds || [],
        purchasedPlayerIds,
        draftHistory: (plainSession.draftHistory || []).map((entry) => ({
            purchaseId: entry.purchaseId,
            playerId: entry.playerId,
            playerName: entry.playerName,
            teamId: entry.teamId,
            price: entry.price,
            positionFilled: entry.positionFilled || null,
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
            try {
                const { playerIds, pooledAt } = await loadPoolPlayerIds();
                session.availablePlayerIds = playerIds;
                session.pooledAt = pooledAt;
                await db.saveDraftSession(session);
            } catch (poolErr) {
                if (poolErr instanceof PlayerPoolUnavailableError) {
                    // US-3.2: when PLAYER_API_URL is set and the upstream
                    // fails, do NOT transition the session or swallow the
                    // error as 500 — reply 503 so the client can retry.
                    return res.status(503).json({
                        success: false,
                        errorMessage: 'Player Data API unavailable. Please try again shortly.'
                    });
                }
                throw poolErr;
            }
        }

        return res.status(200).json({
            success: true,
            draftSession: serializeSession(session)
        });
    } catch (err) {
        console.error('getDraftSession error:', err);
        return res.status(500).json({
            success: false,
            errorMessage: 'Unable to load draft session right now.'
        });
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

const undoPurchase = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { draftSessionId, purchaseId } = req.params;
        if (!purchaseId) {
            return res.status(400).json({ success: false, errorMessage: 'purchaseId is required.' });
        }

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const result = await draftService.undoPurchase(draftSessionId, purchaseId);
        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        }

        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('undoPurchase error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to undo purchase.' });
    }
};

const editPurchase = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { draftSessionId, purchaseId } = req.params;
        if (!purchaseId) {
            return res.status(400).json({ success: false, errorMessage: 'purchaseId is required.' });
        }

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { price, teamId } = req.body || {};
        const parsedPrice = price == null || price === ''
            ? undefined
            : Number(price);

        if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 1)) {
            return res.status(400).json({ success: false, errorMessage: 'price must be a positive number.' });
        }

        const result = await draftService.editPurchase(draftSessionId, purchaseId, {
            newPrice: parsedPrice,
            newTeamId: teamId || undefined
        });
        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        }

        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('editPurchase error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to edit purchase.' });
    }
};

/**
 * US-3.3: Proxy the Player Data API pool through a session-scoped endpoint.
 *
 * GET /draft-sessions/:draftSessionId/players?status=available
 *   &search=&position=&team=&limit=&offset=
 *
 * Returns PlayerStub records whose availability is derived from the session
 * (not from the upstream `isAvailable` flag) so the UI never shows a player
 * as available after it has been purchased in this draft.
 *
 * `status` query values:
 *   - `available` (default): intersect with session.availablePlayerIds
 *   - `purchased`:            intersect with session.purchasedPlayerIds
 *   - `all`:                  no session intersection
 */
const getSessionPlayers = async (req, res) => {
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

        const { search, position, team } = req.query;
        const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'available';
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 200, 1), 2000);
        const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

        // Pull the upstream catalog filtered by name/position/team if provided.
        // The upstream response also carries `dataAsOf` / `staleWarnings` which
        // we forward to the client for freshness UX (consumed by US-11.7).
        let upstreamPlayers = [];
        let dataAsOf = null;
        let staleWarnings = [];

        if (licensedApi.hasConfig()) {
            try {
                const data = await licensedApi.getPlayerPool({ search, position, team });
                upstreamPlayers = Array.isArray(data?.players) ? data.players : [];
                dataAsOf = data?.dataAsOf || null;
                staleWarnings = data?.staleWarnings || [];
            } catch (err) {
                return res.status(503).json({
                    success: false,
                    errorMessage: 'Player Data API unavailable. Please try again shortly.'
                });
            }
        } else {
            // Dev-only fallback: read the locally cached projection rows if the
            // licensed API isn't configured. Mirrors US-3.2's fallback stance.
            const { list } = await db.getPlayers({
                search: search || '',
                team: team || '',
                position: position || '',
                source: 'projection',
                limit: 2000,
                offset: 0
            });
            upstreamPlayers = list || [];
        }

        const availableSet = new Set(session.availablePlayerIds || []);
        const purchasedSet = new Set(session.purchasedPlayerIds || []);

        const intersect = (playerId) => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'purchased') return purchasedSet.has(playerId);
            return availableSet.has(playerId);
        };

        // The upstream `/pool` endpoint honors `position` but currently
        // ignores `search` and `team`. Per US-3.3 we apply those filters
        // locally so the endpoint behaves consistently regardless of
        // what the Player Data API supports today.
        const searchLower = typeof search === 'string' ? search.trim().toLowerCase() : '';
        const teamLower = typeof team === 'string' ? team.trim().toLowerCase() : '';
        const positionUpper = typeof position === 'string' ? position.trim().toUpperCase() : '';

        const matchesLocalFilters = (stub) => {
            if (searchLower && !(stub.name || '').toLowerCase().includes(searchLower)) return false;
            if (teamLower && !(stub.mlbTeam || '').toLowerCase().includes(teamLower)) return false;
            if (positionUpper && !stub.positions.some((p) => String(p).toUpperCase() === positionUpper)) return false;
            return true;
        };

        const stubs = upstreamPlayers
            .map(toPlayerStub)
            .filter((p) => p.playerId && intersect(p.playerId))
            .filter(matchesLocalFilters)
            .map((p) => ({ ...p, isAvailable: availableSet.has(p.playerId) }));

        const total = stubs.length;
        const page = stubs.slice(offset, offset + limit);

        return res.status(200).json({
            success: true,
            players: page,
            total,
            limit,
            offset,
            pooledAt: session.pooledAt || null,
            dataAsOf,
            staleWarnings
        });
    } catch (err) {
        console.error('getSessionPlayers error:', err);
        return res.status(500).json({
            success: false,
            errorMessage: 'Unable to load players for this draft session.'
        });
    }
};

module.exports = {
    createDraftSession,
    getDraftSession,
    updateDraftSession,
    recordPurchase,
    editPurchase,
    undoPurchase,
    getSessionPlayers,
};
