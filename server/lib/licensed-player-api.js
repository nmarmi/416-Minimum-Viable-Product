/**
 * Client for the licensed Player Data API.
 * Uses PLAYER_API_URL and PLAYER_API_KEY from env. If PLAYER_API_URL is not set, all methods return null.
 * Sends both X-API-Key and Authorization: Bearer so the API can use either.
 * Set PLAYER_API_LEGACY=1 to fall back to unversioned paths for older API builds.
 */
const baseUrl = process.env.PLAYER_API_URL || '';
const apiKey = process.env.PLAYER_API_KEY || '';

function hasConfig() {
    return Boolean(baseUrl && apiKey);
}

function getHeaders() {
    return {
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
}

// Returns path prefixed with /api/v1 unless PLAYER_API_LEGACY=1 is set.
function apiPath(path) {
    return process.env.PLAYER_API_LEGACY ? path : `/api/v1${path}`;
}

// Fire-and-forget health check on first import
if (hasConfig()) {
    const healthUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/health`;
    fetch(healthUrl, { method: 'GET', headers: getHeaders() })
        .then(res => console.log(`[player-api] health ${res.ok ? 'ok' : `failed (${res.status})`} — ${healthUrl}`))
        .catch(err => console.log(`[player-api] health check failed — ${healthUrl}: ${err.message}`));
}

/**
 * GET /api/v1/players — list players with optional filtering.
 * Falls back to /players when PLAYER_API_LEGACY=1.
 */
async function getPlayers(params = {}) {
    if (!hasConfig()) return null;
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.team) q.set('team', params.team);
    if (params.position) q.set('position', params.position);
    if (params.limit != null) q.set('limit', params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const query = q.toString();
    const url = `${baseUrl.replace(/\/$/, '')}${apiPath('/players')}${query ? `?${query}` : ''}`;
    try {
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.errorMessage || `API ${res.status}`);
        }
        return data;
    } catch (err) {
        console.error('Licensed API getPlayers error:', err.message);
        throw err;
    }
}

/**
 * GET /api/v1/players/:playerId — fetch a single player by ID.
 * Falls back to /players/:id when PLAYER_API_LEGACY=1.
 */
async function getPlayer(playerId) {
    if (!hasConfig()) return null;
    const url = `${baseUrl.replace(/\/$/, '')}${apiPath('/players')}/${encodeURIComponent(playerId)}`;
    try {
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        if (res.status === 404) return null;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.errorMessage || `API ${res.status}`);
        }
        return data?.player ?? data ?? null;
    } catch (err) {
        console.error('Licensed API getPlayer error:', err.message);
        return null;
    }
}

/**
 * GET /api/v1/players/pool — full player pool in PlayerStub shape.
 */
async function getPlayerPool(params = {}) {
    if (!hasConfig()) return null;
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.team) q.set('team', params.team);
    const position = params.position ?? params.positions;
    if (position) {
        const value = Array.isArray(position) ? position[0] : String(position).split(',')[0].trim();
        if (value) q.set('position', value);
    }
    if (params.limit != null) q.set('limit', params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const query = q.toString();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/pool${query ? `?${query}` : ''}`;
    try {
        const res = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || data.errorMessage || `Player Data API responded with ${res.status}`);
            err.status = res.status;
            err.upstream = data;
            throw err;
        }
        return data;
    } catch (err) {
        console.error('Licensed API getPlayerPool error:', err.message);
        throw err;
    }
}

/**
 * POST /api/v1/players/valuations — z-score auction dollar values.
 * Falls back to /players/valuations when PLAYER_API_LEGACY=1.
 */
async function postValuations(leagueSettings = {}, draftState = {}) {
    if (!hasConfig()) return null;
    const body = { leagueSettings, draftState };
    const url = `${baseUrl.replace(/\/$/, '')}${apiPath('/players/valuations')}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const raw = await res.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }
        if (!res.ok) {
            const err = new Error(data.error || data.errorMessage || `API ${res.status}`);
            err.status = res.status;
            err.url = url;
            err.upstream = data;
            err.raw = raw;
            throw err;
        }
        return data;
    } catch (err) {
        console.error('Licensed API postValuations error:', {
            message: err.message,
            status: err.status,
            url: err.url,
            upstream: err.upstream,
            raw: err.raw
        });
        throw err;
    }
}

/**
 * POST /api/v1/players/recommendations — players worth bidding on, sorted by surplus.
 */
async function postRecommendations(leagueSettings = {}, draftState = {}, teamId = null) {
    if (!hasConfig()) return null;
    const body = { leagueSettings, draftState };
    if (teamId) body.teamId = teamId;
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/recommendations`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const raw = await res.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }
        if (!res.ok) {
            const err = new Error(data.error || data.errorMessage || `API ${res.status}`);
            err.status = res.status;
            err.url = url;
            err.upstream = data;
            err.raw = raw;
            throw err;
        }
        return data;
    } catch (err) {
        console.error('Licensed API postRecommendations error:', {
            message: err.message,
            status: err.status,
            url: err.url,
            upstream: err.upstream
        });
        throw err;
    }
}

/**
 * POST /api/v1/players/recommendations/nominations — recommend who to nominate next at auction.
 * @param {Object} options
 * @param {Object} options.leagueSettings
 * @param {Object} options.draftState — full shape: { availablePlayerIds, purchasedPlayers, teamBudgets, filledRosterSlots }
 * @param {string|null} options.teamId
 */
async function postNominations({ leagueSettings = {}, draftState = {}, teamId = null } = {}) {
    if (!hasConfig()) return null;
    const body = { leagueSettings, draftState };
    if (teamId) body.teamId = teamId;
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/recommendations/nominations`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const raw = await res.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }
        if (!res.ok) {
            const err = new Error(data.error || data.errorMessage || `API ${res.status}`);
            err.status = res.status;
            err.url = url;
            err.upstream = data;
            err.raw = raw;
            throw err;
        }
        return data;
    } catch (err) {
        console.error('Licensed API postNominations error:', {
            message: err.message,
            status: err.status,
            url: err.url,
            upstream: err.upstream
        });
        throw err;
    }
}

/**
 * POST /api/v1/usage — log a usage event.
 */
async function postUsage(payload) {
    if (!hasConfig()) return null;
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/usage`;
    const body = {
        event: payload.event || 'unknown',
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: payload.metadata || {}
    };
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.errorMessage || `API ${res.status}`);
        }
        return data;
    } catch (err) {
        console.error('Licensed API postUsage error:', err.message);
        throw err;
    }
}

const getPlayerById = getPlayer;

module.exports = {
    hasConfig,
    getPlayers,
    getPlayer,
    getPlayerById,
    getPlayerPool,
    postValuations,
    postRecommendations,
    postNominations,
    postUsage
};
