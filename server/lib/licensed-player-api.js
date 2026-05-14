/**
 * Client for the licensed Player Data API (player-data-api repo).
 *
 * Requires env vars:
 *   PLAYER_API_URL  — base URL of the Player Data API (e.g. https://player-data-api.onrender.com)
 *   PLAYER_API_KEY  — a valid API key issued by the developer portal
 *
 * All methods return null when the API is unconfigured so the Draft Kit can
 * fall back to its MongoDB projections without throwing.
 */

const baseUrl = (process.env.PLAYER_API_URL || '').replace(/\/$/, '');
const apiKey  = process.env.PLAYER_API_KEY  || '';

function hasConfig() { return Boolean(baseUrl && apiKey); }

function getHeaders() {
    return {
        'X-API-Key':     apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
    };
}

/** Canonical v1 base for all data-plane endpoints. */
function v1(path) { return `${baseUrl}/api/v1${path}`; }

/** Parse a response body safely — returns {} on empty or malformed JSON. */
async function parseBody(res) {
    const text = await res.text().catch(() => '');
    try { return text ? JSON.parse(text) : {}; } catch (_) { return { raw: text }; }
}

class PlayerDataApiError extends Error {
    constructor(message, { code = null, fields = null, status = null } = {}) {
        super(message);
        this.name   = 'PlayerDataApiError';
        this.code   = code;
        this.fields = fields;
        this.status = status;
    }
}

function throwFromResponse(data, status, url) {
    const err = new PlayerDataApiError(data.error || data.errorMessage || `Player Data API ${status}`, {
        code: data.code || null, fields: data.fields || null, status,
    });
    err.url      = url;
    err.upstream = data;
    throw err;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

async function getPlayers(params = {}) {
    if (!hasConfig()) return null;
    const q = new URLSearchParams();
    if (params.search)    q.set('search',   params.search);
    if (params.team)      q.set('team',     params.team);
    if (params.position)  q.set('position', params.position);
    if (params.limit  != null) q.set('limit',  params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const url = v1(`/players${q.toString() ? `?${q}` : ''}`);
    try {
        const res  = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data;
    } catch (err) {
        console.error('[player-api] getPlayers error:', err.message);
        throw err;
    }
}

async function getPlayer(playerId) {
    if (!hasConfig()) return null;
    const url = v1(`/players/${encodeURIComponent(playerId)}`);
    try {
        const res  = await fetch(url, { method: 'GET', headers: getHeaders() });
        if (res.status === 404) return null;
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data?.player ?? data ?? null;
    } catch (err) {
        console.error('[player-api] getPlayer error:', err.message);
        return null;
    }
}

async function getPlayerPool(params = {}) {
    if (!hasConfig()) return null;
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.team)   q.set('team',   params.team);
    const position = params.position ?? params.positions;
    if (position) {
        const val = Array.isArray(position) ? position[0] : String(position).split(',')[0].trim();
        if (val) q.set('position', val);
    }
    if (params.limit  != null) q.set('limit',  params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const url = v1(`/players/pool${q.toString() ? `?${q}` : ''}`);
    try {
        const res  = await fetch(url, { method: 'GET', headers: getHeaders() });
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data;
    } catch (err) {
        console.error('[player-api] getPlayerPool error:', err.message);
        throw err;
    }
}

async function postValuations(leagueSettings = {}, draftState = {}) {
    if (!hasConfig()) return null;
    const url = v1('/players/valuations');
    try {
        const res  = await fetch(url, {
            method:  'POST',
            headers: getHeaders(),
            body:    JSON.stringify({ leagueSettings, draftState }),
        });
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data;
    } catch (err) {
        console.error('[player-api] postValuations error:', { message: err.message, status: err.status });
        throw err;
    }
}

async function postRecommendations(leagueSettings = {}, draftState = {}, teamId = null) {
    if (!hasConfig()) return null;
    const body = { leagueSettings, draftState };
    if (teamId) body.teamId = teamId;
    const url = v1('/players/recommendations');
    try {
        const res  = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data;
    } catch (err) {
        console.error('[player-api] postRecommendations error:', { message: err.message, status: err.status });
        throw err;
    }
}

async function postNominations({ leagueSettings = {}, draftState = {}, teamId = null } = {}) {
    if (!hasConfig()) return null;
    const body = { leagueSettings, draftState };
    if (teamId) body.teamId = teamId;
    const url = v1('/players/recommendations/nominations');
    try {
        const res  = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        const data = await parseBody(res);
        if (!res.ok) throwFromResponse(data, res.status, url);
        return data;
    } catch (err) {
        console.error('[player-api] postNominations error:', { message: err.message, status: err.status });
        throw err;
    }
}

async function postUsage(payload) {
    if (!hasConfig()) return null;
    const url = v1('/analytics/usage');
    const body = {
        event:     payload.event     || 'unknown',
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata:  payload.metadata  || {},
    };
    try {
        const res  = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
        const data = await parseBody(res);
        if (!res.ok) throw new Error(data.error || data.errorMessage || `API ${res.status}`);
        return data;
    } catch (err) {
        console.error('[player-api] postUsage error:', err.message);
        throw err;
    }
}

// Alias for backward compatibility inside the codebase
const getPlayerById = getPlayer;

module.exports = {
    PlayerDataApiError,
    hasConfig,
    getPlayers,
    getPlayer,
    getPlayerById,
    getPlayerPool,
    postValuations,
    postRecommendations,
    postNominations,
    postUsage,
};
