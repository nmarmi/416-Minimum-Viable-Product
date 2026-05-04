const request = require('supertest');
const createApp = require('./helpers/createApp');
const db = require('../db');
const auth = require('../auth');

const app = createApp();

afterEach(() => {
    vi.restoreAllMocks();
});

const OWNER_ID = 'owner123';
const OTHER_ID = 'other456';

function ownerCookie() {
    return `token=${auth.signToken(OWNER_ID)}`;
}

function otherCookie() {
    return `token=${auth.signToken(OTHER_ID)}`;
}

// ── POST /leagues ─────────────────────────────────────────────────────────────

describe('POST /leagues (createLeague)', () => {
    test('no auth -> 401', async () => {
        const res = await request(app).post('/leagues').send({ name: 'Test League' });
        expect(res.status).toBe(401);
    });

    test('empty name -> 400', async () => {
        const res = await request(app)
            .post('/leagues')
            .set('Cookie', ownerCookie())
            .send({ name: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.errorMessage).toBeDefined();
    });

    test('missing name -> 400', async () => {
        const res = await request(app)
            .post('/leagues')
            .set('Cookie', ownerCookie())
            .send({});
        expect(res.status).toBe(400);
    });

    test('success -> 201 with league and draftSession', async () => {
        vi.spyOn(db, 'createLeague').mockResolvedValue({
            _id: 'league123',
            name: 'My League',
            owner: OWNER_ID
        });
        vi.spyOn(db, 'createDraftSession').mockResolvedValue({
            draftSessionId: 'draft-test-abc',
            leagueId: 'league123',
            status: 'setup',
            leagueSettings: { numberOfTeams: 12, salaryCap: 260, rosterSlots: {}, scoringType: '5x5 Roto', draftType: 'AUCTION' },
            teams: [],
            availablePlayerIds: [],
            purchasedPlayerIds: [],
            draftHistory: []
        });
        vi.spyOn(db, 'setLeagueDraftSession').mockResolvedValue(null);

        const res = await request(app)
            .post('/leagues')
            .set('Cookie', ownerCookie())
            .send({ name: 'My League' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.league.name).toBe('My League');
        expect(res.body.draftSession.draftSessionId).toBe('draft-test-abc');
    });
});

// ── GET /leagues ──────────────────────────────────────────────────────────────

describe('GET /leagues (getMyLeagues)', () => {
    test('no auth -> 401', async () => {
        const res = await request(app).get('/leagues');
        expect(res.status).toBe(401);
    });

    test('success -> 200 with leagues array', async () => {
        vi.spyOn(db, 'getLeaguesForUser').mockResolvedValue([
            { _id: 'l1', name: 'League One', owner: OWNER_ID },
            { _id: 'l2', name: 'League Two', owner: OWNER_ID }
        ]);

        const res = await request(app)
            .get('/leagues')
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.leagues).toHaveLength(2);
    });
});

// ── DELETE /leagues/:leagueId ─────────────────────────────────────────────────

describe('DELETE /leagues/:leagueId (deleteLeague)', () => {
    test('no auth -> 401', async () => {
        const res = await request(app).delete('/leagues/league123');
        expect(res.status).toBe(401);
    });

    test('league not found -> 404', async () => {
        vi.spyOn(db, 'getLeagueById').mockResolvedValue(null);

        const res = await request(app)
            .delete('/leagues/nonexistent')
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(404);
    });

    test('non-owner -> 403', async () => {
        vi.spyOn(db, 'getLeagueById').mockResolvedValue({
            _id: 'league123',
            name: 'My League',
            owner: OWNER_ID,
            draftSessionId: null
        });

        const res = await request(app)
            .delete('/leagues/league123')
            .set('Cookie', otherCookie());

        expect(res.status).toBe(403);
    });

    test('owner can delete -> 200', async () => {
        vi.spyOn(db, 'getLeagueById').mockResolvedValue({
            _id: 'league123',
            name: 'My League',
            owner: OWNER_ID,
            draftSessionId: null
        });
        vi.spyOn(db, 'deleteLeagueById').mockResolvedValue({});

        const res = await request(app)
            .delete('/leagues/league123')
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('owner deletes league with draft session — also deletes session', async () => {
        vi.spyOn(db, 'getLeagueById').mockResolvedValue({
            _id: 'league123',
            name: 'My League',
            owner: OWNER_ID,
            draftSessionId: 'session-abc'
        });
        const deleteSpy = vi.spyOn(db, 'deleteDraftSessionBySessionId').mockResolvedValue({});
        vi.spyOn(db, 'deleteLeagueById').mockResolvedValue({});

        const res = await request(app)
            .delete('/leagues/league123')
            .set('Cookie', ownerCookie());

        expect(res.status).toBe(200);
        expect(deleteSpy).toHaveBeenCalledWith('session-abc');
    });
});
