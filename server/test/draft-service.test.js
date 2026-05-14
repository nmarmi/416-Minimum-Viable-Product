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

    test('US-7.3: roster full -> rejects with no state change', async () => {
        // Fill all 5 slots (C:1, OF:2, SP:1, BENCH:1) — openSlots = 0.
        const session = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 210, // already spent 50 across 5 picks
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
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 10
        });

        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/full/i);

        // No state change: budget intact, no new history entry, player still available.
        const after = await DraftSession.findOne({ draftSessionId: session.draftSessionId });
        const team1 = after.teams.find((t) => t.teamId === 'team1');
        expect(team1.budgetRemaining).toBe(210);
        expect(team1.purchasedPlayers).toHaveLength(5);
        expect(after.availablePlayerIds).toContain('p1');
        expect(after.draftHistory).toHaveLength(0);
    });

    test('US-7.3: roster boundary — last open slot succeeds, then next purchase rejects', async () => {
        // 4 of 5 slots filled → openSlots = 1; the next pick is allowed,
        // but the one after that hits the full-roster guard.
        const session = await createSession({
            teams: [{
                teamId: 'team1',
                teamName: 'Team One',
                budgetRemaining: 220,
                purchasedPlayers: [
                    { playerId: 'x1', price: 10 },
                    { playerId: 'x2', price: 10 },
                    { playerId: 'x3', price: 10 },
                    { playerId: 'x4', price: 10 },
                ],
                filledRosterSlots: new Map([['C', 1], ['OF', 2], ['SP', 1], ['BENCH', 0]])
            }, {
                teamId: 'team2',
                teamName: 'Team Two',
                budgetRemaining: 260,
                purchasedPlayers: [],
                filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]])
            }]
        });

        const ok = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 5
        });
        expect(ok.success).toBe(true);

        const overflow = await draftService.recordPurchase(session.draftSessionId, {
            playerId: 'p2', playerName: 'Player Two', teamId: 'team1', price: 5
        });
        expect(overflow.success).toBe(false);
        expect(overflow.errorMessage).toMatch(/full/i);
    });

    test.each(['setup', 'paused', 'completed'])(
        'US-7.4: recordPurchase rejects when status is "%s"',
        async (status) => {
            const session = await createSession({ status });

            const result = await draftService.recordPurchase(session.draftSessionId, {
                playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 10
            });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toMatch(/not active/i);
            expect(result.errorMessage).toContain(status);

            // No state change.
            const after = await DraftSession.findOne({ draftSessionId: session.draftSessionId });
            expect(after.draftHistory).toHaveLength(0);
            expect(after.availablePlayerIds).toContain('p1');
        }
    );
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

    test.each(['setup', 'paused', 'completed'])(
        'US-7.4: undoPurchase rejects when status is "%s"',
        async (status) => {
            // Build a session that already has a purchase recorded so undo has a target.
            const active = await createSession({
                draftHistory: [{
                    purchaseId: 'existing-purchase',
                    playerId: 'p1', playerName: 'Player One', teamId: 'team1',
                    price: 50, positionFilled: 'OF',
                    timestamp: new Date(), nominationOrder: 1,
                }],
                purchasedPlayerIds: ['p1'],
                availablePlayerIds: ['p2', 'p3', 'p4', 'p5'],
                teams: [
                    { teamId: 'team1', teamName: 'Team One', budgetRemaining: 210,
                      purchasedPlayers: [{ playerId: 'p1', price: 50 }],
                      filledRosterSlots: new Map([['C', 0], ['OF', 1], ['SP', 0], ['BENCH', 0]]) },
                    { teamId: 'team2', teamName: 'Team Two', budgetRemaining: 260,
                      purchasedPlayers: [],
                      filledRosterSlots: new Map([['C', 0], ['OF', 0], ['SP', 0], ['BENCH', 0]]) },
                ],
                status,
            });

            const result = await draftService.undoPurchase(active.draftSessionId, 'existing-purchase');

            expect(result.success).toBe(false);
            expect(result.errorMessage).toMatch(/not active/i);

            // No state change.
            const after = await DraftSession.findOne({ draftSessionId: active.draftSessionId });
            expect(after.draftHistory).toHaveLength(1);
            expect(after.purchasedPlayerIds).toContain('p1');
        }
    );
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

    test.each(['setup', 'paused', 'completed'])(
        'US-7.4: editPurchase rejects when status is "%s"',
        async (status) => {
            // Record a purchase against an active session, then flip the status
            // and try to edit. This proves the guard fires regardless of how we
            // got into the inactive state.
            const active = await createSession();
            const purchase = await draftService.recordPurchase(active.draftSessionId, {
                playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 50
            });
            const purchaseId = purchase.snapshot.draftHistory[0].purchaseId;

            await DraftSession.updateOne({ draftSessionId: active.draftSessionId }, { status });

            const result = await draftService.editPurchase(active.draftSessionId, purchaseId, { newPrice: 60 });

            expect(result.success).toBe(false);
            expect(result.errorMessage).toMatch(/not active/i);

            // No state change: the original $50 price stays.
            const after = await DraftSession.findOne({ draftSessionId: active.draftSessionId });
            const team = after.teams.find((t) => t.teamId === 'team1');
            expect(after.draftHistory[0].price).toBe(50);
            expect(team.budgetRemaining).toBe(210);
        }
    );
});

// ── US-7.5: State consistency invariants ─────────────────────────────────────

describe('US-7.5: state consistency invariants', () => {
    /**
     * Invariant A — player conservation:
     *   availablePlayerIds.length + purchasedPlayerIds.length === totalPlayers
     */
    function assertPlayerConservation(session, totalPlayers) {
        const available = session.availablePlayerIds?.length ?? 0;
        const purchased = session.purchasedPlayerIds?.length ?? 0;
        expect(available + purchased).toBe(totalPlayers);
        // No double-counting: a playerId is either available OR purchased, never both.
        const overlap = (session.availablePlayerIds || []).filter((id) =>
            (session.purchasedPlayerIds || []).includes(id)
        );
        expect(overlap).toHaveLength(0);
    }

    /**
     * Invariant B — budget conservation:
     *   sum(team.budgetRemaining) + sum(team.purchasedPlayers.price)
     *     === numberOfTeams * salaryCap
     */
    function assertBudgetConservation(session) {
        const numTeams = session.leagueSettings.numberOfTeams;
        const cap      = session.leagueSettings.salaryCap;
        const totalCap = numTeams * cap;

        let remaining = 0;
        let spent = 0;
        for (const team of session.teams) {
            remaining += Number(team.budgetRemaining || 0);
            for (const p of team.purchasedPlayers || []) {
                spent += Number(p.price || 0);
            }
        }
        expect(remaining + spent).toBe(totalCap);
    }

    async function reload(sessionId) {
        return DraftSession.findOne({ draftSessionId: sessionId });
    }

    test('invariants hold across initialize → purchase → purchase → edit price → edit team → undo → re-record', async () => {
        // Seed with 5 available players, 2 teams, $260 cap each, 5 roster slots per team.
        const session = await createSession();
        const totalPlayers = session.availablePlayerIds.length + (session.purchasedPlayerIds?.length || 0);
        const sessionId = session.draftSessionId;

        // Step 0 — fresh active session.
        let snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 1 — record p1 to team1 for $50.
        const r1 = await draftService.recordPurchase(sessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 50
        });
        expect(r1.success).toBe(true);
        const p1Id = r1.snapshot.draftHistory[0].purchaseId;
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 2 — record p2 to team2 for $30.
        const r2 = await draftService.recordPurchase(sessionId, {
            playerId: 'p2', playerName: 'Player Two', teamId: 'team2', price: 30
        });
        expect(r2.success).toBe(true);
        const p2Id = r2.snapshot.draftHistory[1].purchaseId;
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 3 — edit p1's price from $50 → $40 (refund $10 to team1).
        const e1 = await draftService.editPurchase(sessionId, p1Id, { newPrice: 40 });
        expect(e1.success).toBe(true);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 4 — move p2 from team2 → team1 (refund team2 $30, charge team1 $30).
        const e2 = await draftService.editPurchase(sessionId, p2Id, { newTeamId: 'team1' });
        expect(e2.success).toBe(true);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 5 — undo p2's purchase (player back to available, refund $30 to team1).
        const u1 = await draftService.undoPurchase(sessionId, p2Id);
        expect(u1.success).toBe(true);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Step 6 — re-record p2 to team2 for $25.
        const r3 = await draftService.recordPurchase(sessionId, {
            playerId: 'p2', playerName: 'Player Two', teamId: 'team2', price: 25
        });
        expect(r3.success).toBe(true);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);
    });

    test('invariants survive a rejected duplicate purchase (US-7.1) and a rejected overrun (US-7.2)', async () => {
        const session = await createSession();
        const totalPlayers = session.availablePlayerIds.length;
        const sessionId = session.draftSessionId;

        // Establish a recorded baseline so the "after" assertions have signal.
        await draftService.recordPurchase(sessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team1', price: 80
        });
        let snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Duplicate purchase → rejected; invariants must still hold.
        const dup = await draftService.recordPurchase(sessionId, {
            playerId: 'p1', playerName: 'Player One', teamId: 'team2', price: 20
        });
        expect(dup.success).toBe(false);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);

        // Budget overrun → rejected; invariants must still hold.
        // team1 has $180 remaining and 4 open slots → maxBid = 180 - 3 = 177.
        const overrun = await draftService.recordPurchase(sessionId, {
            playerId: 'p2', playerName: 'Player Two', teamId: 'team1', price: 200
        });
        expect(overrun.success).toBe(false);
        snap = await reload(sessionId);
        assertPlayerConservation(snap, totalPlayers);
        assertBudgetConservation(snap);
    });
});

describe('US-15.1 seasonYear round-trips through create → update → fetch', () => {
    it('defaults to current year when not provided', async () => {
        const DraftSession = require('../models/draft-session-model');
        const session = await DraftSession.create({
            draftSessionId: `test-year-default-${Date.now()}`,
            leagueId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            leagueSettings: { numberOfTeams: 10, salaryCap: 260 },
            teams: [],
        });
        const plain = session.toObject();
        expect(plain.leagueSettings.seasonYear).toBe(new Date().getFullYear());
    });

    it('persists an explicit seasonYear', async () => {
        const DraftSession = require('../models/draft-session-model');
        const session = await DraftSession.create({
            draftSessionId: `test-year-explicit-${Date.now()}`,
            leagueId: new mongoose.Types.ObjectId(),
            createdBy: new mongoose.Types.ObjectId(),
            leagueSettings: { numberOfTeams: 10, salaryCap: 260, seasonYear: 2028 },
            teams: [],
        });
        const fetched = await DraftSession.findOne({ draftSessionId: session.draftSessionId }).lean();
        expect(fetched.leagueSettings.seasonYear).toBe(2028);
    });

    it('sanitizeLeagueSettings accepts seasonYear ≥ 2000', () => {
        const { sanitizeLeagueSettings } = require('../services/draft-defaults');
        const result = sanitizeLeagueSettings({ numberOfTeams: 10, salaryCap: 260, seasonYear: 2031 });
        expect(result.seasonYear).toBe(2031);
    });

    it('sanitizeLeagueSettings rejects year < 2000 and falls back to current year', () => {
        const { sanitizeLeagueSettings } = require('../services/draft-defaults');
        const result = sanitizeLeagueSettings({ numberOfTeams: 10, salaryCap: 260, seasonYear: 1990 });
        expect(result.seasonYear).toBe(new Date().getFullYear());
    });

    it('serializeSession includes seasonYear', () => {
        const { serializeSession } = require('../services/draft-defaults');
        const fakeSession = {
            draftSessionId: 'fake',
            name: 'Test',
            status: 'setup',
            leagueId: new mongoose.Types.ObjectId().toString(),
            leagueSettings: { seasonYear: 2026, numberOfTeams: 10, salaryCap: 260, rosterSlots: new Map() },
            teams: [],
            draftHistory: [],
            purchasedPlayerIds: [],
        };
        const serialized = serializeSession(fakeSession);
        expect(serialized.leagueSettings.seasonYear).toBe(2026);
    });
});
