const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DraftSession = require('../models/draft-session-model');
const draftService = require('../services/draft-service');

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
});

// ── helpers ───────────────────────────────────────────────────────────────────

function buildSession(overrides = {}) {
    return {
        draftSessionId: `session-${Date.now()}`,
        leagueId: new mongoose.Types.ObjectId(),
        createdBy: new mongoose.Types.ObjectId(),
        status: 'active',
        leagueSettings: {
            numberOfTeams: 2,
            salaryCap: 260,
            rosterSlots: { C: 1, OF: 2, SP: 1, BENCH: 1 },
            scoringType: '5x5 Roto',
            draftType: 'AUCTION'
        },
        teams: [
            {
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            },
            {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }
        ],
        availablePlayerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        purchasedPlayerIds: [],
        draftHistory: [],
        nominationOrder: 0,
        ...overrides
    };
}

async function createSession(overrides = {}) {
    return await DraftSession.create(buildSession(overrides));
}

// ── recordPurchase ────────────────────────────────────────────────────────────

describe('draftService.recordPurchase', () => {
    test('success — moves player, debits budget, appends history', async () => {
        const session = await createSession();
        const { draftSessionId } = session;

        const result = await draftService.recordPurchase(draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 25
        });

        expect(result.success).toBe(true);
        expect(result.snapshot.availablePlayerIds).not.toContain('p1');
        expect(result.snapshot.purchasedPlayerIds).toContain('p1');

        const team = result.snapshot.teams.find((t) => t.teamId === 'team1');
        expect(team.budgetRemaining).toBe(235);
        expect(team.purchasedPlayers).toHaveLength(1);
        expect(result.snapshot.draftHistory).toHaveLength(1);
        expect(result.snapshot.draftHistory[0].playerName).toBe('Player One');
        expect(result.snapshot.draftHistory[0].price).toBe(25);
    });

    test('player not in available pool -> failure', async () => {
        const session = await createSession();

        const result = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'not-in-pool',
            playerName: 'Nobody',
            teamId: 'team1',
            price: 10
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/not available/i);
    });

    test('US-7.1: duplicate purchase of same playerId -> failure with specific message', async () => {
        const session = await createSession();

        const first = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 10
        });
        expect(first.success).toBe(true);

        // Same player, second purchase attempt — should be flagged as already purchased.
        const dup = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team2', price: 15
        });
        expect(dup.success).toBe(false);
        expect(dup.errorMessage).toMatch(/already.*purchased/i);

        // No state change: team2 still has full budget, p1 still on team1.
        const after = await DraftSession.findOne({ draftSessionId: session.draftSessionId });
        const team1 = after.teams.find((t) => t.teamId === 'team1');
        const team2 = after.teams.find((t) => t.teamId === 'team2');
        expect(team1.purchasedPlayers).toHaveLength(1);
        expect(team2.purchasedPlayers).toHaveLength(0);
        expect(team2.budgetRemaining).toBe(260);
        expect(after.draftHistory).toHaveLength(1);
    });

    test('US-7.2: price exceeds max bid (budgetRemaining − (openSlots − 1)) -> failure with insufficient-budget message', async () => {
        const session = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 5,   // 5 remaining, 4 open slots → maxBid = 5-(4-1) = 2
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }, {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }]
        });

        const result = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 3  // maxBid is 2
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/insufficient.*budget/i);

        // No state change: budget intact, player still available, no history entry.
        const after = await DraftSession.findOne({ draftSessionId: session.draftSessionId });
        const team1 = after.teams.find((t) => t.teamId === 'team1');
        expect(team1.budgetRemaining).toBe(5);
        expect(team1.purchasedPlayers).toHaveLength(0);
        expect(after.availablePlayerIds).toContain('p1');
        expect(after.draftHistory).toHaveLength(0);
    });

    test('US-7.2: price equal to max bid succeeds (boundary case)', async () => {
        // Total roster slots in default fixture = C:1 + OF:2 + SP:1 + BENCH:1 = 5.
        // budget = 5, openSlots = 5 → maxBid = 5 − (5 − 1) = 1.
        const session = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 5,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }, {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }]
        });

        const result = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 1
        });
        expect(result.success).toBe(true);

        // Bumping to 2 (maxBid + 1) must reject.
        await DraftSession.deleteMany({});
        const session2 = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 5,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }, {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }]
        });
        const overrun = await draftService.recordPurchase(session2.draftSessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 2
        });
        expect(overrun.success).toBe(false);
        expect(overrun.errorMessage).toMatch(/insufficient.*budget/i);
    });

    test('roster is full -> failure', async () => {
        // Fill all 5 slots (C:1, OF:2, SP:1, BENCH:1)
        const session = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 260,
                purchasedPlayers: [
                    { playerId: 'x1', price: 10 },
                    { playerId: 'x2', price: 10 },
                    { playerId: 'x3', price: 10 },
                    { playerId: 'x4', price: 10 },
                    { playerId: 'x5', price: 10 },
                ],
                filledRosterSlots: new Map([['C', 1], ['OF', 2], ['SP', 1], ['BENCH', 1]])
            }, {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }]
        });

        const result = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 10
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/full/i);
    });

    test('draft not active (completed) -> failure', async () => {
        const session = await createSession({ status: 'completed' });

        const result = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 10
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/not active/i);
    });
});

// ── undoPurchase ──────────────────────────────────────────────────────────────

describe('draftService.undoPurchase', () => {
    test('success — restores availability, refunds budget', async () => {
        const session = await createSession();
        // Record a purchase first
        const purchase = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 50
        });
        const purchaseId = purchase.snapshot.draftHistory[0].purchaseId;

        const result = await draftService.undoPurchase(session.draftSessionId, purchaseId);

        expect(result.success).toBe(true);
        expect(result.snapshot.availablePlayerIds).toContain('p1');
        expect(result.snapshot.purchasedPlayerIds).not.toContain('p1');

        const team = result.snapshot.teams.find((t) => t.teamId === 'team1');
        expect(team.budgetRemaining).toBe(260);
        expect(team.purchasedPlayers).toHaveLength(0);
        expect(result.snapshot.draftHistory).toHaveLength(0);
    });

    test('purchase not found -> failure', async () => {
        const session = await createSession();

        const result = await draftService.undoPurchase(session.draftSessionId, 'purchase-nonexistent');

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/not found/i);
    });
});

// ── editPurchase ──────────────────────────────────────────────────────────────

describe('draftService.editPurchase', () => {
    test('change price — updates team budget and history', async () => {
        const session = await createSession();
        const purchase = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 50
        });
        const purchaseId = purchase.snapshot.draftHistory[0].purchaseId;

        const result = await draftService.editPurchase(session.draftSessionId, purchaseId, { newPrice: 30 });

        expect(result.success).toBe(true);
        const team = result.snapshot.teams.find((t) => t.teamId === 'team1');
        expect(team.budgetRemaining).toBe(230);
        expect(result.snapshot.draftHistory[0].price).toBe(30);
    });

    test('invalid price (0) -> failure', async () => {
        const session = await createSession();
        const purchase = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1',
            playerName: 'Player One',
            teamId: 'team1',
            price: 50
        });
        const purchaseId = purchase.snapshot.draftHistory[0].purchaseId;

        const result = await draftService.editPurchase(session.draftSessionId, purchaseId, { newPrice: 0 });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/whole number/i);
    });
});
