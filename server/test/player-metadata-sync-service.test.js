const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const PlayerStub = require('../models/player-stub-model');
const {
    syncPlayerMetadata,
    normalizeStub,
    formatSummary
} = require('../services/player-metadata-sync-service');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await PlayerStub.deleteMany({});
});

function fakeApi(players) {
    return {
        hasConfig: () => true,
        getPlayerPool: async () => ({
            success: true,
            dataAsOf: '2026-05-11T00:00:00.000Z',
            staleWarnings: [],
            players
        })
    };
}

describe('player metadata sync service', () => {
    test('normalizeStub maps Player Data API records into PlayerStub shape', () => {
        const syncedAt = new Date('2026-05-11T12:00:00.000Z');
        const stub = normalizeStub({
            playerId: ' mlb-123 ',
            name: ' Player One ',
            positions: ['OF', null, ' 1B '],
            mlbTeam: ' NYM ',
            status: 'starter',
            isAvailable: false,
            depthChartRank: '2',
            depthChartPosition: 'OF'
        }, '2026-05-11T00:00:00.000Z', syncedAt);

        expect(stub).toMatchObject({
            playerId: 'mlb-123',
            name: 'Player One',
            positions: ['OF', '1B'],
            mlbTeam: 'NYM',
            status: 'starter',
            isAvailable: false,
            depthChartRank: 2,
            depthChartPosition: 'OF',
            source: 'player-data-api',
            lastSyncedAt: syncedAt
        });
        expect(stub.dataAsOf.toISOString()).toBe('2026-05-11T00:00:00.000Z');
    });

    test('upserts new records and logs counts', async () => {
        const logger = { log: vi.fn() };

        const summary = await syncPlayerMetadata({
            api: fakeApi([
                { playerId: 'mlb-1', name: 'Player One', positions: ['OF'], mlbTeam: 'NYM' },
                { playerId: 'mlb-2', name: 'Player Two', positions: ['SP'], mlbTeam: 'ATL' }
            ]),
            logger,
            syncedAt: new Date('2026-05-11T12:00:00.000Z')
        });

        expect(summary).toMatchObject({
            newCount: 2,
            updatedCount: 0,
            unchangedCount: 0,
            totalCount: 2
        });
        expect(await PlayerStub.countDocuments()).toBe(2);
        expect(logger.log).toHaveBeenCalledWith('Player metadata sync complete: new=2 updated=0 unchanged=0 total=2');
    });

    test('counts updated and unchanged records on subsequent sync', async () => {
        await PlayerStub.create([
            {
                playerId: 'mlb-1',
                name: 'Player One',
                positions: ['OF'],
                mlbTeam: 'NYM',
                status: 'active',
                isAvailable: true,
                source: 'player-data-api',
                dataAsOf: new Date('2026-05-11T00:00:00.000Z'),
                lastSyncedAt: new Date('2026-05-11T01:00:00.000Z')
            },
            {
                playerId: 'mlb-2',
                name: 'Old Name',
                positions: ['SP'],
                mlbTeam: 'ATL',
                status: 'active',
                isAvailable: true,
                source: 'player-data-api',
                dataAsOf: new Date('2026-05-11T00:00:00.000Z'),
                lastSyncedAt: new Date('2026-05-11T01:00:00.000Z')
            }
        ]);

        const summary = await syncPlayerMetadata({
            api: fakeApi([
                { playerId: 'mlb-1', name: 'Player One', positions: ['OF'], mlbTeam: 'NYM', status: 'active' },
                { playerId: 'mlb-2', name: 'Player Two', positions: ['SP'], mlbTeam: 'ATL', status: 'active' },
                { playerId: 'mlb-3', name: 'Player Three', positions: ['SS'], mlbTeam: 'CHC', status: 'active' }
            ]),
            logger: null,
            syncedAt: new Date('2026-05-11T12:00:00.000Z')
        });

        expect(summary).toMatchObject({
            newCount: 1,
            updatedCount: 1,
            unchangedCount: 1,
            totalCount: 3
        });

        const updated = await PlayerStub.findOne({ playerId: 'mlb-2' }).lean();
        expect(updated.name).toBe('Player Two');
        const unchanged = await PlayerStub.findOne({ playerId: 'mlb-1' }).lean();
        expect(unchanged.lastSyncedAt.toISOString()).toBe('2026-05-11T12:00:00.000Z');
    });

    test('requires Player Data API config', async () => {
        await expect(syncPlayerMetadata({
            api: { hasConfig: () => false },
            logger: null
        })).rejects.toThrow('PLAYER_API_URL and PLAYER_API_KEY are required');
    });

    test('formatSummary includes all required counts', () => {
        expect(formatSummary({
            newCount: 1,
            updatedCount: 2,
            unchangedCount: 3,
            totalCount: 6
        })).toBe('Player metadata sync complete: new=1 updated=2 unchanged=3 total=6');
    });
});
