const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const createApp = require('./helpers/createApp');
const auth = require('../auth');
const db = require('../db');
const licensedApi = require('../lib/licensed-player-api');
const DraftSession = require('../models/draft-session-model');

const app = createApp();

const OWNER_ID = new mongoose.Types.ObjectId().toString();
const OTHER_ID = new mongoose.Types.ObjectId().toString();
const LEAGUE_ID = new mongoose.Types.ObjectId();

function ownerCookie() { return `token=${auth.signToken(OWNER_ID)}`; }
function otherCookie() { return `token=${auth.signToken(OTHER_ID)}`; }

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
    await DraftSession.deleteMany({});
    // Stub the league lookup so the controller's `getLeagueForUser` accepts
    // requests from OWNER_ID and rejects requests from OTHER_ID.
    vi.spyOn(db, 'getLeagueById').mockImplementation(async () => ({
        _id: LEAGUE_ID,
        owner: new mongoose.Types.ObjectId(OWNER_ID),
    }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function seedActiveSessionWithPurchase() {
    const draftSessionId = `session-${Date.now()}`;
    const session = await DraftSession.create({
        draftSessionId,
        leagueId: LEAGUE_ID,
        createdBy: new mongoose.Types.ObjectId(OWNER_ID),
        status: 'active',
        leagueSettings: {
            numberOfTeams: 2, salaryCap: 260,
            rosterSlots: { C: 1, OF: 2, SP: 1, BENCH: 1 },
            scoringType: '5x5 Roto', draftType: 'AUCTION',
        },
        teams: [
            {
                teamId: 'team1', teamName: 'Team One', budgetRemaining: 210,
                purchasedPlayers: [{ playerId: 'p1', price: 50 }],
                filledRosterSlots: new Map([['C', 0], ['OF', 1], ['SP', 0], ['BENCH', 0]]),
            },
            {
                teamId: 'team2', teamName: 'Team Two', budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]]),
            },
        ],
        availablePlayerIds: ['p2', 'p3', 'p4', 'p5'],
        purchasedPlayerIds: ['p1'],
        draftHistory: [{
            purchaseId: 'purchase-1',
            playerId: 'p1', playerName: 'Player One', teamId: 'team1',
            price: 50, positionFilled: 'OF',
            timestamp: new Date(), nominationOrder: 1,
        }],
        nominationOrder: 1,
    });
    return session;
}

async function seedSetupSession(overrides = {}) {
    return await DraftSession.create({
        draftSessionId: `setup-session-${Date.now()}`,
        leagueId: LEAGUE_ID,
        createdBy: new mongoose.Types.ObjectId(OWNER_ID),
        status: 'setup',
        leagueSettings: {
            numberOfTeams: 2,
            salaryCap: 260,
            rosterSlots: { C: 1, OF: 1, SP: 1 },
            scoringType: '5x5 Roto',
            draftType: 'AUCTION',
        },
        teams: [
            { teamId: 'team1', teamName: 'Team One', budgetRemaining: 0, purchasedPlayers: [], filledRosterSlots: {} },
            { teamId: 'team2', teamName: 'Team Two', budgetRemaining: 0, purchasedPlayers: [], filledRosterSlots: {} },
        ],
        availablePlayerIds: [],
        purchasedPlayerIds: [],
        draftHistory: [],
        ...overrides,
    });
}

// ── GET /draft-sessions — US-8.8 ─────────────────────────────────────────────

describe('GET /draft-sessions (US-8.8 getMyDraftSessions)', () => {
    test('no auth -> 401', async () => {
        const res = await request(app).get('/draft-sessions');
        expect(res.status).toBe(401);
    });

    test('authenticated user with no sessions -> empty array', async () => {
        const res = await request(app).get('/draft-sessions').set('Cookie', ownerCookie());
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.draftSessions).toEqual([]);
    });

    test('returns only sessions belonging to the requesting user', async () => {
        // OWNER_ID session
        await DraftSession.create({
            draftSessionId: 'session-owner-1',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OWNER_ID),
            status: 'setup',
            leagueSettings: { numberOfTeams: 10, salaryCap: 260, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
        });
        // OTHER_ID session — must not appear in owner's response
        await DraftSession.create({
            draftSessionId: 'session-other-1',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OTHER_ID),
            status: 'active',
            leagueSettings: { numberOfTeams: 8, salaryCap: 200, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
        });

        const res = await request(app).get('/draft-sessions').set('Cookie', ownerCookie());
        expect(res.status).toBe(200);
        expect(res.body.draftSessions).toHaveLength(1);
        expect(res.body.draftSessions[0].draftSessionId).toBe('session-owner-1');
    });

    test('response shape contains required fields', async () => {
        await DraftSession.create({
            draftSessionId: 'session-shape',
            name: 'My League Draft',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OWNER_ID),
            status: 'active',
            leagueSettings: { numberOfTeams: 12, salaryCap: 260, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
        });

        const res = await request(app).get('/draft-sessions').set('Cookie', ownerCookie());
        expect(res.status).toBe(200);
        const s = res.body.draftSessions[0];
        expect(s.draftSessionId).toBe('session-shape');
        expect(s.name).toBe('My League Draft');
        expect(s.status).toBe('active');
        expect(s.createdAt).toBeDefined();
        expect(s.numberOfTeams).toBe(12);
    });

    test('results sorted by createdAt descending', async () => {
        const t1 = new Date('2024-01-01T00:00:00Z');
        const t2 = new Date('2024-06-01T00:00:00Z');
        await DraftSession.create({
            draftSessionId: 'session-old',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OWNER_ID),
            status: 'setup',
            leagueSettings: { numberOfTeams: 10, salaryCap: 260, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
            createdAt: t1,
        });
        await DraftSession.create({
            draftSessionId: 'session-new',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OWNER_ID),
            status: 'active',
            leagueSettings: { numberOfTeams: 12, salaryCap: 260, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
            createdAt: t2,
        });

        const res = await request(app).get('/draft-sessions').set('Cookie', ownerCookie());
        expect(res.status).toBe(200);
        expect(res.body.draftSessions[0].draftSessionId).toBe('session-new');
        expect(res.body.draftSessions[1].draftSessionId).toBe('session-old');
    });
});

describe('US-12.1 player pool hydration', () => {
    test('start draft pulls player IDs from GET /api/v1/players/pool', async () => {
        const session = await seedSetupSession({ draftSessionId: 'setup-hydrate-start' });
        vi.spyOn(licensedApi, 'hasConfig').mockReturnValue(true);
        vi.spyOn(licensedApi, 'getPlayerPool').mockResolvedValue({
            players: [
                { playerId: 'mlb-1', name: 'Player One' },
                { id: 'mlb-2', name: 'Player Two' },
                { playerId: 'mlb-1', name: 'Duplicate Player One' },
            ],
            dataAsOf: '2026-05-11T00:00:00.000Z',
        });

        const res = await request(app)
            .post(`/draft-sessions/${session.draftSessionId}/start`)
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(licensedApi.getPlayerPool).toHaveBeenCalledTimes(1);
        expect(res.body.draftSession.status).toBe('active');
        expect(res.body.draftSession.availablePlayerIds).toEqual(['mlb-1', 'mlb-2']);
    });

    test('session players re-fetch pool and pass through depth chart metadata plus dataAsOf', async () => {
        await DraftSession.create({
            draftSessionId: 'active-hydrate-players',
            leagueId: LEAGUE_ID,
            createdBy: new mongoose.Types.ObjectId(OWNER_ID),
            status: 'active',
            leagueSettings: { numberOfTeams: 2, salaryCap: 260, rosterSlots: { OF: 1 }, scoringType: '5x5 Roto', draftType: 'AUCTION' },
            teams: [],
            availablePlayerIds: ['mlb-1', 'mlb-2'],
            purchasedPlayerIds: ['mlb-3'],
            pooledAt: new Date('2026-05-11T01:00:00.000Z'),
        });
        vi.spyOn(licensedApi, 'hasConfig').mockReturnValue(true);
        vi.spyOn(licensedApi, 'getPlayerPool').mockResolvedValue({
            players: [
                {
                    playerId: 'mlb-1',
                    name: 'Player One',
                    positions: ['OF'],
                    mlbTeam: 'NYM',
                    status: 'starter',
                    depthChartRank: 1,
                    depthChartPosition: 'OF',
                    hr: 31,
                    rbi: 96,
                    r: 88,
                    sb: 12,
                    avg: 0.284,
                },
                { playerId: 'mlb-2', name: 'Player Two', positions: ['SP'], mlbTeam: 'ATL', status: 'active' },
                { playerId: 'mlb-3', name: 'Purchased Player', positions: ['C'], mlbTeam: 'LAD', status: 'active' },
            ],
            dataAsOf: '2026-05-11T00:00:00.000Z',
            staleWarnings: ['depth chart is 2 days old'],
        });

        const res = await request(app)
            .get('/draft-sessions/active-hydrate-players/players?status=available')
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(licensedApi.getPlayerPool).toHaveBeenCalledTimes(1);
        expect(res.body.players).toHaveLength(2);
        expect(res.body.players[0]).toMatchObject({
            playerId: 'mlb-1',
            name: 'Player One',
            positions: ['OF'],
            mlbTeam: 'NYM',
            status: 'starter',
            depthChartRank: 1,
            depthChartPosition: 'OF',
            dataAsOf: '2026-05-11T00:00:00.000Z',
            isAvailable: true,
            hr: 31,
            rbi: 96,
            r: 88,
            sb: 12,
            avg: 0.284,
        });
        expect(res.body.players.map((p) => p.playerId)).not.toContain('mlb-3');
        expect(res.body.dataAsOf).toBe('2026-05-11T00:00:00.000Z');
        expect(res.body.staleWarnings).toEqual(['depth chart is 2 days old']);
    });
});

// ── DELETE /draft-sessions/:id/purchases/:purchaseId — US-8.6 ────────────────

describe('DELETE /draft-sessions/:id/purchases/:purchaseId (US-8.6 undoPurchase)', () => {
    test('no auth -> 401', async () => {
        const session = await seedActiveSessionWithPurchase();
        const res = await request(app).delete(`/draft-sessions/${session.draftSessionId}/purchases/purchase-1`);
        expect(res.status).toBe(401);
    });

    test('non-owner -> 403', async () => {
        const session = await seedActiveSessionWithPurchase();
        const res = await request(app)
            .delete(`/draft-sessions/${session.draftSessionId}/purchases/purchase-1`)
            .set('Cookie', otherCookie());
        expect(res.status).toBe(403);
    });

    test('unknown session -> 404', async () => {
        const res = await request(app)
            .delete('/draft-sessions/no-such-session/purchases/purchase-1')
            .set('Cookie', ownerCookie());
        expect(res.status).toBe(404);
        expect(res.body.errorMessage).toMatch(/draft session not found/i);
    });

    test('unknown purchaseId -> 404 (US-8.6 spec)', async () => {
        const session = await seedActiveSessionWithPurchase();
        const res = await request(app)
            .delete(`/draft-sessions/${session.draftSessionId}/purchases/nonexistent-purchase`)
            .set('Cookie', ownerCookie());
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.errorMessage).toMatch(/purchase\s+not\s+found/i);
    });

    test('success -> 200 with reversed state', async () => {
        const session = await seedActiveSessionWithPurchase();
        const res = await request(app)
            .delete(`/draft-sessions/${session.draftSessionId}/purchases/purchase-1`)
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const snap = res.body.draftSession;
        // Player back to available pool, history empty, budget refunded.
        expect(snap.availablePlayerIds).toContain('p1');
        expect(snap.purchasedPlayerIds).not.toContain('p1');
        expect(snap.draftHistory).toHaveLength(0);
        const team1 = snap.teams.find((t) => t.teamId === 'team1');
        expect(team1.budgetRemaining).toBe(260);
        expect(team1.purchasedPlayers).toHaveLength(0);
    });
});
