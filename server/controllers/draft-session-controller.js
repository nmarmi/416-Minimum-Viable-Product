const mongoose = require('mongoose');
const auth = require('../auth');
const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');
const { PlayerDataApiError } = licensedApi;
const { toPlayerApiLeagueSettings, toPlayerApiDraftState } = require('../lib/player-api-adapter');
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
async function loadPoolPlayerIds(options = {}) {
    const { playerIds, pooledAt } = await fetchPoolPlayerIds(options);
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

        // US-8.4: GET is read-only. The pool is populated by the explicit
        // POST /start action; in `setup` status `availablePlayerIds` may be empty.
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

        // US-18.1 / US-19.1: carry keepers and minor league players from the incoming payload
        nextTeams.forEach((team) => {
            const src = incomingTeams.find((t) => t.teamId === team.teamId);
            if (!src) return;
            if (Array.isArray(src.keepers))            team.keepers            = src.keepers;
            if (Array.isArray(src.minorLeaguePlayers)) team.minorLeaguePlayers = src.minorLeaguePlayers;
        });

        session.leagueSettings = nextSettings;
        session.teams = nextTeams;

        // US-26.1/26.2: persist taxi draft order when provided
        if (Array.isArray(req.body?.taxiDraftOrder)) {
            session.taxiDraftOrder = req.body.taxiDraftOrder;
        }

        // US-6.5: persist the user's chosen "my team" so the sidebar / roster
        // tab can bind to it across sessions. Accepts an explicit null to clear.
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'myTeamId')) {
            const requested = req.body.myTeamId;
            if (requested === null || requested === '') {
                session.myTeamId = null;
            } else if (typeof requested === 'string' && nextTeams.some((t) => t.teamId === requested)) {
                session.myTeamId = requested;
            } else {
                return res.status(400).json({ success: false, errorMessage: `Unknown teamId for myTeamId: ${requested}` });
            }
        }

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
        const { playerId, playerName, teamId, price, notes } = req.body || {};

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

        const result = await draftService.recordPurchase(draftSessionId, { playerId, playerName, teamId, price: parsedPrice, notes });
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
            // US-8.6: an unknown purchaseId is a 404 — the resource doesn't
            // exist. Other failures (status guard, state issues) stay 400.
            const status = /purchase\s+not\s+found/i.test(result.errorMessage || '') ? 404 : 400;
            return res.status(status).json({ success: false, errorMessage: result.errorMessage });
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
        const { newPrice, newTeamId, newNotes } = req.body || {};

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const result = await draftService.editPurchase(draftSessionId, purchaseId, { newPrice, newTeamId, newNotes });
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
            .map((player) => toPlayerStub(player, dataAsOf))
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

        const leagueSettings = toPlayerApiLeagueSettings(session.leagueSettings, { forValuations: true });
        const draftState = toPlayerApiDraftState(session);

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
            ...(err instanceof PlayerDataApiError ? { errorCode: err.code, fieldErrors: err.fields } : {}),
            upstreamStatus: err.status || null,
            upstreamUrl: err.url || null,
            upstreamBody: err.upstream || null
        });
    }
};

/**
 * US-1.8 / US-8.4: Explicit `POST /draft-sessions/:id/start` action that
 * validates setup, runs `initializeDraft`, populates `availablePlayerIds`
 * from the Player Data API pool, and transitions the session to `active`.
 * Idempotent for sessions already `active` (returns the current snapshot);
 * rejects `paused`/`completed`. Returns 503 when the Player Data API is
 * unreachable so the session stays in `setup`.
 */
const startDraft = async (req, res) => {
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
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can start this draft.' });
        }

        if (session.status === 'active') {
            return res.status(200).json({ success: true, draftSession: serializeSession(session) });
        }

        if (session.status !== 'setup') {
            return res.status(400).json({
                success: false,
                errorMessage: `Cannot start a draft in '${session.status}' status.`
            });
        }

        const numberOfTeams = Number(session.leagueSettings?.numberOfTeams) || 0;
        const salaryCap = Number(session.leagueSettings?.salaryCap) || 0;
        const rosterSlotTotal = Object.values(toPlainObject(session.leagueSettings?.rosterSlots))
            .reduce((sum, n) => sum + (Number(n) || 0), 0);

        if (numberOfTeams < 2 || salaryCap < 1 || rosterSlotTotal < 1) {
            return res.status(400).json({
                success: false,
                errorMessage: 'Draft settings incomplete: need at least 2 teams, salary cap > 0, and one roster slot.'
            });
        }

        const leagueScope = session.leagueSettings?.leagueScope || 'MLB';
        let pool;
        try {
            pool = await loadPoolPlayerIds({ leagueScope });
        } catch (poolErr) {
            if (poolErr instanceof PlayerPoolUnavailableError) {
                return res.status(503).json({
                    success: false,
                    errorMessage: 'Player Data API unavailable. Please try again shortly.'
                });
            }
            throw poolErr;
        }

        session.availablePlayerIds = pool.playerIds;
        session.pooledAt = pool.pooledAt;
        await db.saveDraftSession(session);

        const result = await draftService.initializeDraft(req.params.draftSessionId);
        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        }

        return res.status(200).json({
            success: true,
            draftSession: serializeSession(result.session)
        });
    } catch (err) {
        console.error('startDraft error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to start draft right now.' });
    }
};

/**
 * GET /:draftSessionId/recommendations
 * Calls POST /api/v1/players/recommendations on the licensed Player Data API using
 * the session's available player pool and league settings. Returns recommendations
 * sorted by value surplus so the client can render the sidebar bid guidance.
 *
 * Returns 200 with empty recommendations if the licensed API is not configured.
 */
const getSessionRecommendations = async (req, res) => {
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
            return res.status(200).json({ success: true, recommendations: [] });
        }

        const leagueSettings = toPlayerApiLeagueSettings(session.leagueSettings, { forValuations: false });
        const { availablePlayerIds } = toPlayerApiDraftState(session);
        const teamId = session.myTeamId || null;

        const data = await licensedApi.postRecommendations(leagueSettings, { availablePlayerIds }, teamId);
        return res.status(200).json({
            success: true,
            recommendations: data?.recommendations || []
        });
    } catch (err) {
        console.error('getSessionRecommendations error:', err);
        return res.status(err.status || 500).json({
            success: false,
            errorMessage: 'Unable to load recommendations.',
            ...(err instanceof PlayerDataApiError ? { errorCode: err.code, fieldErrors: err.fields } : {}),
            upstreamStatus: err.status || null,
            upstreamUrl: err.url || null,
            upstreamBody: err.upstream || null
        });
    }
};

const getMyDraftSessions = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const sessions = await db.getDraftSessionsForUser(userId);

        const draftSessions = sessions.map(s => ({
            draftSessionId: s.draftSessionId,
            name: s.name ?? '',
            status: s.status,
            createdAt: s.createdAt,
            numberOfTeams: s.leagueSettings?.numberOfTeams ?? 0,
        }));

        return res.status(200).json({ success: true, draftSessions });
    } catch (err) {
        console.error('getMyDraftSessions error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to load draft sessions.' });
    }
};

const setPlayerNote = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const { draftSessionId, playerId } = req.params;
        const { note } = req.body || {};

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) {
            return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });
        }

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league) {
            return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        }

        const result = await draftService.setPlayerNote(draftSessionId, playerId, note);
        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        }

        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('setPlayerNote error:', err);
        return res.status(500).json({ success: false, errorMessage: 'Unable to save player note.' });
    }
};

// US-18.2: move a purchased player to a different position slot
const movePosition = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { draftSessionId, purchaseId } = req.params;
        const { positionFilled, eligiblePositions = [] } = req.body || {};

        if (!positionFilled) {
            return res.status(400).json({ success: false, errorMessage: 'positionFilled is required.', code: 'MISSING_FIELDS' });
        }

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can move players.' });
        }

        const result = await draftService.movePosition(draftSessionId, purchaseId, { positionFilled, eligiblePositions });

        if (!result.success) {
            return res.status(400).json({ success: false, errorMessage: result.errorMessage, code: result.code });
        }

        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('[draft] movePosition error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to move player.' });
    }
};

// US-22.4: redo — re-apply the top of the undo stack
const redoPurchase = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { draftSessionId } = req.params;
        const result = await draftService.redoPurchase(draftSessionId);
        if (!result.success) return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('[draft] redoPurchase error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to redo.' });
    }
};

// US-19.3: move a minor league player to a different team
const moveMinor = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { draftSessionId, playerId } = req.params;
        const { teamId } = req.body || {};
        if (!teamId) return res.status(400).json({ success: false, errorMessage: 'teamId is required.', code: 'MISSING_FIELDS' });

        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Draft session not found.' });

        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) {
            return res.status(403).json({ success: false, errorMessage: 'Only the league owner can move minors.' });
        }

        const result = await draftService.moveMinor(draftSessionId, playerId, { teamId });
        if (!result.success) return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('[draft] moveMinor error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to move minor league player.' });
    }
};

// Rubric: Player Details — Transactions/Contract Status — proxies to Player Data API
const getPlayerTransactions = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        const { playerId } = req.params;
        if (!licensedApi.hasConfig()) return res.json({ success: true, transactions: [] });
        const apiBase = (process.env.PLAYER_API_URL || '').replace(/\/$/, '');
        const apiKey  = process.env.PLAYER_API_KEY || '';
        const resp = await fetch(`${apiBase}/api/v1/players/${encodeURIComponent(playerId)}/transactions`, {
            headers: { 'X-API-Key': apiKey, 'Authorization': `Bearer ${apiKey}` },
        });
        const data = await resp.json().catch(() => ({}));
        return res.json({ success: true, transactions: data.transactions || [] });
    } catch (err) {
        console.error('[player] getPlayerTransactions error:', err.message);
        return res.json({ success: true, transactions: [] });
    }
};

// US-26.1/26.2: set taxi draft order
const setTaxiOrder = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        const { draftSessionId } = req.params;
        const { taxiDraftOrder } = req.body || {};
        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Session not found.' });
        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        const result = await draftService.setTaxiOrder(draftSessionId, taxiDraftOrder);
        if (!result.success) return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('[taxi] setTaxiOrder error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to update taxi order.' });
    }
};

// US-26.3: record a taxi pick
const recordTaxiPick = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        const { draftSessionId } = req.params;
        const { teamId, playerId, playerName } = req.body || {};
        if (!teamId || !playerId) return res.status(400).json({ success: false, errorMessage: 'teamId and playerId required.', code: 'MISSING_FIELDS' });
        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Session not found.' });
        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        const result = await draftService.recordTaxiPick(draftSessionId, { teamId, playerId, playerName: playerName || playerId });
        if (!result.success) return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        return res.status(201).json({ success: true, draftSession: serializeSession(result.session), outOfOrder: result.outOfOrder, taxiPickId: result.taxiPickId });
    } catch (err) {
        console.error('[taxi] recordTaxiPick error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to record taxi pick.' });
    }
};

// US-26.6: undo a taxi pick
const undoTaxiPick = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        const { draftSessionId, taxiPickId } = req.params;
        const session = await DraftSession.findOne({ draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Session not found.' });
        const league = await getLeagueForUser(session.leagueId, userId);
        if (!league || String(league.owner) !== String(userId)) return res.status(403).json({ success: false, errorMessage: 'Unauthorized' });
        const result = await draftService.undoTaxiPick(draftSessionId, taxiPickId);
        if (!result.success) return res.status(400).json({ success: false, errorMessage: result.errorMessage });
        return res.status(200).json({ success: true, draftSession: serializeSession(result.session) });
    } catch (err) {
        console.error('[taxi] undoTaxiPick error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to undo taxi pick.' });
    }
};

// US-25.1: proxy the Player Data API SSE push stream so the browser API key stays server-side
const streamEvents = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        if (!licensedApi.hasConfig()) {
            return res.status(503).json({ success: false, errorMessage: 'Player Data API not configured.' });
        }

        const session = await DraftSession.findOne({ draftSessionId: req.params.draftSessionId });
        if (!session) return res.status(404).json({ success: false, errorMessage: 'Session not found.' });

        // Pass `since` through for client reconnection
        const since = req.query.since || '0';
        const playerIds = (session.availablePlayerIds || []).slice(0, 300).join(',');
        const qs = `since=${since}${playerIds ? `&playerIds=${encodeURIComponent(playerIds)}` : ''}`;

        const apiBase = (process.env.PLAYER_API_URL || '').replace(/\/$/, '');
        const apiKey  = process.env.PLAYER_API_KEY || '';
        const upstream = `${apiBase}/api/v1/events/stream?${qs}`;

        res.setHeader('Content-Type',  'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection',    'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const abortController = new AbortController();
        req.on('close', () => abortController.abort());

        const upstreamRes = await fetch(upstream, {
            headers: { 'X-API-Key': apiKey, 'Authorization': `Bearer ${apiKey}` },
            signal: abortController.signal,
        });

        const reader = upstreamRes.body.getReader();
        const dec    = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(dec.decode(value, { stream: true }));
        }
        res.end();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('[events] SSE proxy error:', err.message);
            try { res.write('event: error\ndata: {"message":"Stream ended"}\n\n'); res.end(); } catch (_) {}
        }
    }
};

// US-21.1: single player details — proxies to Player Data API, keeps key server-side
const getSessionPlayer = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { playerId } = req.params;
        if (!licensedApi.hasConfig()) {
            return res.status(200).json({ success: false, errorMessage: 'Player Data API not configured.' });
        }

        const player = await licensedApi.getPlayer(playerId);
        if (!player) return res.status(404).json({ success: false, errorMessage: 'Player not found.' });
        return res.status(200).json({ success: true, player: toPlayerStub(player) });
    } catch (err) {
        console.error('[draft] getSessionPlayer error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to fetch player.' });
    }
};

module.exports = {
    getMyDraftSessions,
    createDraftSession,
    getDraftSession,
    updateDraftSession,
    startDraft,
    recordPurchase,
    undoPurchase,
    editPurchase,
    movePosition,
    redoPurchase,
    moveMinor,
    streamEvents,
    getPlayerTransactions,
    setTaxiOrder,
    recordTaxiPick,
    undoTaxiPick,
    getSessionPlayer,
    getSessionPlayers,
    getSessionValuations,
    getSessionRecommendations,
    setPlayerNote,
};
