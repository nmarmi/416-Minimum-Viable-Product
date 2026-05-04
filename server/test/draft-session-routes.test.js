const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const createApp = require('./helpers/createApp');
const auth = require('../auth');
const db = require('../db');
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
