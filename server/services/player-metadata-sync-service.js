const PlayerStub = require('../models/player-stub-model');
const licensedApi = require('../lib/licensed-player-api');
const { toPlayerStub } = require('./player-pool-service');

const SYNC_FIELDS = [
    'playerId',
    'name',
    'positions',
    'mlbTeam',
    'status',
    'isAvailable',
    'depthChartRank',
    'depthChartPosition',
    'source',
    'dataAsOf'
];

function normalizeDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeString(value) {
    if (value == null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
}

function normalizePositions(positions) {
    if (!Array.isArray(positions)) return [];
    return positions
        .map((position) => normalizeString(position))
        .filter(Boolean);
}

function normalizeNumber(value) {
    if (value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizeStub(raw, dataAsOf = null, syncedAt = new Date()) {
    const stub = toPlayerStub(raw);
    const playerId = normalizeString(stub.playerId);
    if (!playerId) return null;

    return {
        playerId,
        name: normalizeString(stub.name) || playerId,
        positions: normalizePositions(stub.positions),
        mlbTeam: normalizeString(stub.mlbTeam),
        status: normalizeString(stub.status) || 'active',
        isAvailable: raw.isAvailable == null ? true : Boolean(raw.isAvailable),
        depthChartRank: normalizeNumber(stub.depthChartRank),
        depthChartPosition: normalizeString(stub.depthChartPosition),
        source: 'player-data-api',
        dataAsOf: normalizeDate(dataAsOf),
        lastSyncedAt: syncedAt
    };
}

function comparableValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((entry) => String(entry)).sort();
    if (value == null) return null;
    return value;
}

function hasComparableChanges(existing, next) {
    return SYNC_FIELDS.some((field) => {
        const previousValue = comparableValue(existing[field]);
        const nextValue = comparableValue(next[field]);
        return JSON.stringify(previousValue) !== JSON.stringify(nextValue);
    });
}

function formatSummary(summary) {
    return [
        `Player metadata sync complete:`,
        `new=${summary.newCount}`,
        `updated=${summary.updatedCount}`,
        `unchanged=${summary.unchangedCount}`,
        `total=${summary.totalCount}`
    ].join(' ');
}

async function syncPlayerMetadata(options = {}) {
    const api = options.api || licensedApi;
    const model = options.model || PlayerStub;
    const logger = options.logger || console;
    const syncedAt = options.syncedAt || new Date();

    if (!api.hasConfig()) {
        throw new Error('PLAYER_API_URL and PLAYER_API_KEY are required to sync player metadata.');
    }

    const data = await api.getPlayerPool();
    const rawPlayers = Array.isArray(data?.players) ? data.players : [];
    const dataAsOf = data?.dataAsOf || null;
    const seen = new Set();
    const normalized = [];

    for (const raw of rawPlayers) {
        const stub = normalizeStub(raw, dataAsOf, syncedAt);
        if (!stub || seen.has(stub.playerId)) continue;
        seen.add(stub.playerId);
        normalized.push(stub);
    }

    const existingRows = await model.find({ playerId: { $in: normalized.map((stub) => stub.playerId) } }).lean();
    const existingById = new Map(existingRows.map((row) => [row.playerId, row]));
    const operations = [];
    const summary = {
        newCount: 0,
        updatedCount: 0,
        unchangedCount: 0,
        totalCount: normalized.length,
        dataAsOf: normalizeDate(dataAsOf),
        syncedAt,
        staleWarnings: Array.isArray(data?.staleWarnings) ? data.staleWarnings : []
    };

    for (const stub of normalized) {
        const existing = existingById.get(stub.playerId);
        if (!existing) {
            summary.newCount += 1;
            operations.push({
                updateOne: {
                    filter: { playerId: stub.playerId },
                    update: { $set: stub },
                    upsert: true
                }
            });
            continue;
        }

        if (hasComparableChanges(existing, stub)) {
            summary.updatedCount += 1;
            operations.push({
                updateOne: {
                    filter: { playerId: stub.playerId },
                    update: { $set: stub }
                }
            });
        } else {
            summary.unchangedCount += 1;
            operations.push({
                updateOne: {
                    filter: { playerId: stub.playerId },
                    update: { $set: { lastSyncedAt: syncedAt } }
                }
            });
        }
    }

    if (operations.length > 0) {
        await model.bulkWrite(operations, { ordered: false });
    }

    if (logger && typeof logger.log === 'function') {
        logger.log(formatSummary(summary));
    }

    return summary;
}

module.exports = {
    syncPlayerMetadata,
    normalizeStub,
    hasComparableChanges,
    formatSummary
};
