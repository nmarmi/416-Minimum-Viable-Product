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
const {
    DEFAULT_NUM_TEAMS,
    DEFAULT_SCORING_TYPE,
    DEFAULT_DRAFT_TYPE,
    DEFAULT_SALARY_CAP,
    DEFAULT_ROSTER_SLOTS,
    SCORING_TYPES,
    toPositiveInt,
    toPlainObject,
    buildFilledRosterSlots,
    normalizePurchasedPlayers,
    buildTeams,
    sanitizeRosterSlots,
    sanitizeLeagueSettings,
    generateDraftSessionId,
    serializeSession
} = require('../services/draft-defaults');

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
        const { newPrice, newTeamId } = req.body || {};

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const result = await draftService.editPurchase(draftSessionId, purchaseId, { newPrice, newTeamId });
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

const PITCHER_SLOT_KEYS = new Set(['SP', 'RP', 'P']);
const BENCH_SLOT_KEYS = new Set(['BENCH', 'BN']);

function computeRosterSlotCounts(rosterSlots = {}) {
    let hitterSlotsPerTeam = 0;
    let pitcherSlotsPerTeam = 0;
    for (const [pos, count] of Object.entries(rosterSlots)) {
        const n = Number(count || 0);
        const key = pos.toUpperCase();
        if (PITCHER_SLOT_KEYS.has(key)) {
            pitcherSlotsPerTeam += n;
        } else if (!BENCH_SLOT_KEYS.has(key)) {
            hitterSlotsPerTeam += n;
        }
    }
    return { hitterSlotsPerTeam, pitcherSlotsPerTeam };
}

/**
 * GET /:draftSessionId/valuations
 * Calls POST /api/v1/players/valuations on the licensed Player Data API using
 * the session's league settings and available player list. Returns the
 * valuations array so the client can build a { playerId -> dollarValue } map.
 *
 * Returns 200 with empty valuations if the licensed API is not configured.
 */
const getSessionValuations = async (req, res) => {
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

        if (!licensedApi.hasConfig()) {
            return res.status(200).json({ success: true, valuations: [] });
        }

        const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots || {});
        const { hitterSlotsPerTeam, pitcherSlotsPerTeam } = computeRosterSlotCounts(rosterSlots);

        const leagueSettings = {
            numTeams: session.leagueSettings?.numberOfTeams || DEFAULT_NUM_TEAMS,
            budget: session.leagueSettings?.salaryCap || DEFAULT_SALARY_CAP,
            hitterBudgetPct: 0.675,
            hitterSlotsPerTeam,
            pitcherSlotsPerTeam,
            statSeason: 2025
        };

        const draftState = session.availablePlayerIds?.length > 0
            ? { availablePlayerIds: session.availablePlayerIds }
            : {};

        const data = await licensedApi.postValuations(leagueSettings, draftState);
        return res.status(200).json({
            success: true,
            valuations: data?.valuations || []
        });
    } catch (err) {
        console.error('getSessionValuations error:', err);
        return res.status(err.status || 500).json({
            success: false,
            errorMessage: 'Unable to load valuations.',
            upstreamStatus: err.status || null,
            upstreamUrl: err.url || null,
            upstreamBody: err.upstream || null
        });
    }
};

module.exports = {
    createDraftSession,
    getDraftSession,
    updateDraftSession,
    recordPurchase,
    undoPurchase,
    editPurchase,
    getSessionPlayers,
    getSessionValuations,
};
