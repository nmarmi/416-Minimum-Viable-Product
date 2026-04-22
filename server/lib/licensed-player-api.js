/**
 * Client for the licensed Player Data API.
 * Uses PLAYER_API_URL and PLAYER_API_KEY from env. If PLAYER_API_URL is not set, all methods return null.
 * Sends both X-API-Key and Authorization: Bearer so the API can use either.
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

/**
 * Pull: GET /players from the licensed API.
 * @param {Object} params - { search, team, position, limit, offset }
 * @returns {Promise<{ success: boolean, players: Array, total: number }>}
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
    const url = `${baseUrl.replace(/\/$/, '')}/players${query ? `?${query}` : ''}`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: getHeaders()
        });
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
 * Fetch a single player by ID: GET /players/:playerId from the licensed API.
 * @param {string} playerId
 * @returns {Promise<Object|null>} player object or null if not found / API not configured
 */
async function getPlayer(playerId) {
    if (!hasConfig()) return null;
    const url = `${baseUrl.replace(/\/$/, '')}/players/${encodeURIComponent(playerId)}`;
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
 * Pull: GET /api/v1/players/pool from the licensed API.
 * Returns the full player pool in `PlayerStub` shape plus `dataAsOf` / `staleWarnings`.
 * Supported filters (all optional): search, position(s), team, limit, offset.
 * @param {Object} params
 * @returns {Promise<{ success: boolean, players: Array, dataAsOf?: string, staleWarnings?: Array, apiVersion?: string } | null>}
 */
async function getPlayerPool(params = {}) {
    if (!hasConfig()) return null;
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.team) q.set('team', params.team);
    const position = params.position ?? params.positions;
    if (position) {
        // Upstream /pool expects `position` (singular). If we get an
        // array or comma-delimited list, take the first value and
        // rely on local filtering in the caller for the rest.
        const value = Array.isArray(position) ? position[0] : String(position).split(',')[0].trim();
        if (value) q.set('position', value);
    }
    if (params.limit != null) q.set('limit', params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const query = q.toString();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/pool${query ? `?${query}` : ''}`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: getHeaders()
        });
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
 * POST /api/v1/players/valuations — runs the z-score auction dollar value
 * algorithm and returns dollarValue per player.
 * @param {Object} leagueSettings - { numTeams, budget, hitterBudgetPct, hitterSlotsPerTeam, pitcherSlotsPerTeam, statSeason }
 * @param {Object} draftState - optionally { availablePlayerIds: string[] }
 * @returns {Promise<{ success: boolean, valuations: Array } | null>}
 */
async function postValuations(leagueSettings = {}, draftState = {}) {
    if (!hasConfig()) return null;
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/players/valuations`;
    const body = { leagueSettings, draftState };
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
        console.error('Licensed API postValuations error:', err.message);
        throw err;
    }
}

/**
 * Push: POST /usage to the licensed API.
 * @param {Object} payload - { event, timestamp, metadata }
 * @returns {Promise<{ success: boolean } | null>}
 */
async function postUsage(payload) {
    if (!hasConfig()) return null;
    const url = `${baseUrl.replace(/\/$/, '')}/usage`;
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

module.exports = {
    hasConfig,
    getPlayers,
    getPlayer,
    getPlayerPool,
    postValuations,
    postUsage
};
