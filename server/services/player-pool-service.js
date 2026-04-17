const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');

/**
 * Thrown when PLAYER_API_URL is configured but the Player Data API
 * cannot be reached (per US-3.2). Controllers translate this into a
 * 503 so callers don't accidentally transition a session into `active`
 * with an empty pool.
 */
class PlayerPoolUnavailableError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'PlayerPoolUnavailableError';
        this.cause = cause;
    }
}

/**
 * Map an upstream Player Data API record to the `PlayerStub` shape the
 * Draft Kit UI consumes. Extra fields (depthChartRank/Position) are
 * included when available so US-12.3 can consume them without another
 * round trip.
 */
function toPlayerStub(raw = {}) {
    const positions = Array.isArray(raw.positions) && raw.positions.length > 0
        ? raw.positions
        : (raw.position ? [raw.position] : []);

    return {
        playerId: String(raw.playerId || raw.id || ''),
        name: raw.name || raw.playerName || '',
        positions,
        mlbTeam: raw.mlbTeam || raw.team || null,
        status: raw.status || 'active',
        depthChartRank: raw.depthChartRank ?? null,
        depthChartPosition: raw.depthChartPosition ?? null
    };
}

/**
 * US-3.2 core: returns the player IDs that should populate
 * `DraftSession.availablePlayerIds` when a session transitions
 * setup → active.
 *
 * Behavior:
 *  - If PLAYER_API_URL is set, call GET /api/v1/players/pool once and
 *    return every playerId in the response. Errors throw
 *    PlayerPoolUnavailableError so the caller can respond with 503.
 *  - If PLAYER_API_URL is NOT set, fall back to the legacy local
 *    MongoDB Player collection (documented as a dev-only fallback).
 */
async function fetchPoolPlayerIds() {
    if (licensedApi.hasConfig()) {
        let data;
        try {
            data = await licensedApi.getPlayerPool();
        } catch (err) {
            throw new PlayerPoolUnavailableError(
                `Player Data API unavailable: ${err.message}`,
                err
            );
        }

        const players = Array.isArray(data?.players) ? data.players : [];
        const seen = new Set();
        const playerIds = [];
        for (const p of players) {
            const id = String(p.playerId || p.id || '').trim();
            if (id && !seen.has(id)) {
                seen.add(id);
                playerIds.push(id);
            }
        }

        return {
            playerIds,
            pooledAt: new Date(),
            source: 'player-data-api',
            dataAsOf: data?.dataAsOf || null,
            staleWarnings: data?.staleWarnings || []
        };
    }

    // Dev-only fallback — keeps local test flows working before the
    // Player Data API is wired up.
    const playerIds = await db.getAvailablePlayerIds({ source: 'projection' });
    return {
        playerIds: playerIds || [],
        pooledAt: new Date(),
        source: 'mongodb-fallback',
        dataAsOf: null,
        staleWarnings: []
    };
}

module.exports = {
    fetchPoolPlayerIds,
    toPlayerStub,
    PlayerPoolUnavailableError
};
