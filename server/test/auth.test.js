const request = require('supertest');
const bcrypt = require('bcryptjs');
const createApp = require('./helpers/createApp');
const db = require('../db');
const auth = require('../auth');

const app = createApp();

let testPasswordHash;

beforeAll(async () => {
    // Use low rounds so bcrypt doesn't slow down the test suite
    testPasswordHash = await bcrypt.hash('testpass123', 4);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
    test('success — creates user and returns cookie', async () => {
        vi.spyOn(db, 'getUserByEmail').mockResolvedValue(null);
        vi.spyOn(db, 'createUser').mockResolvedValue({
            _id: 'user123',
            userName: 'testuser',
            email: 'test@test.com',
            avatar: 'default-avatar'
        });

        const res = await request(app)
            .post('/auth/register')
            .send({ userName: 'testuser', email: 'test@test.com', password: 'testpass123', passwordVerify: 'testpass123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']).toBeDefined();
    });

    test('missing fields -> 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'test@test.com' });
        expect(res.status).toBe(400);
        expect(res.body.errorMessage).toBeDefined();
    });

    test('password shorter than 8 chars -> 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ userName: 'u', email: 'e@e.com', password: 'short', passwordVerify: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.errorMessage).toMatch(/8 characters/);
    });

    test('passwords do not match -> 400', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ userName: 'u', email: 'e@e.com', password: 'testpass123', passwordVerify: 'different1' });
        expect(res.status).toBe(400);
        expect(res.body.errorMessage).toMatch(/same password/);
    });

    test('duplicate email -> 400', async () => {
        vi.spyOn(db, 'getUserByEmail').mockResolvedValue({ _id: 'existing', email: 'dupe@test.com' });

        const res = await request(app)
            .post('/auth/register')
            .send({ userName: 'u', email: 'dupe@test.com', password: 'testpass123', passwordVerify: 'testpass123' });

        expect(res.status).toBe(400);
        expect(res.body.errorMessage).toMatch(/already exists/);
    });
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
    test('success — returns user and sets cookie', async () => {
        vi.spyOn(db, 'getUserByEmail').mockResolvedValue({
            _id: 'user123',
            userName: 'testuser',
            email: 'test@test.com',
            avatar: 'default-avatar',
            passwordHash: testPasswordHash
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com', password: 'testpass123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe('test@test.com');
        expect(res.headers['set-cookie']).toBeDefined();
    });

    test('wrong password -> 401', async () => {
        vi.spyOn(db, 'getUserByEmail').mockResolvedValue({
            _id: 'user123',
            passwordHash: testPasswordHash
        });

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
    });

    test('user not found -> 401', async () => {
        vi.spyOn(db, 'getUserByEmail').mockResolvedValue(null);

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'notfound@test.com', password: 'testpass123' });

        expect(res.status).toBe(401);
    });

    test('missing fields -> 400', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com' });
        expect(res.status).toBe(400);
    });
});

// ── GET /auth/logout ──────────────────────────────────────────────────────────

describe('GET /auth/logout', () => {
    test('clears the token cookie', async () => {
        const res = await request(app).get('/auth/logout');
        const cookie = res.headers['set-cookie']?.[0] ?? '';
        // Cookie is cleared by setting value to empty and expires to epoch
        expect(cookie).toMatch(/token=/);
    });
});

// ── GET /auth/loggedIn ────────────────────────────────────────────────────────

describe('GET /auth/loggedIn', () => {
    test('no cookie -> returns loggedIn: false', async () => {
        const res = await request(app).get('/auth/loggedIn');
        expect(res.status).toBe(200);
        expect(res.body.loggedIn).toBe(false);
    });

    test('valid cookie -> returns loggedIn: true with user data', async () => {
        const token = auth.signToken('user123');
        vi.spyOn(db, 'getUserById').mockResolvedValue({
            _id: 'user123',
            userName: 'testuser',
            email: 'test@test.com',
            avatar: 'default-avatar'
        });

        const res = await request(app)
            .get('/auth/loggedIn')
            .set('Cookie', `token=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.loggedIn).toBe(true);
        expect(res.body.user.userName).toBe('testuser');
    });
});

describe('US-16.2 Password reset flow', () => {
    const crypto = require('crypto');

    function makeTokenHash(rawToken) {
        return crypto.createHash('sha256').update(rawToken).digest('hex');
    }

    // ── forgot-password ──────────────────────────────────────────────────────

    it('POST /auth/forgot-password — missing email returns 400', async () => {
        const res = await request(app).post('/auth/forgot-password').send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('MISSING_EMAIL');
    });

    it('POST /auth/forgot-password — unknown email returns 200 (no enumeration)', async () => {
        const User = require('../models/user-model');
        vi.spyOn(User, 'findOne').mockResolvedValue(null);
        const res = await request(app)
            .post('/auth/forgot-password')
            .send({ email: 'nobody@nowhere.com' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // Must NOT reveal whether the email exists
        expect(res.body.token).toBeUndefined();
    });

    it('POST /auth/forgot-password — known email returns token in dev mode', async () => {
        const User = require('../models/user-model');
        const fakeUser = {
            email: 'user@example.com',
            resetTokenHash: null,
            resetTokenExpiresAt: null,
            save: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser);
        const res = await request(app)
            .post('/auth/forgot-password')
            .send({ email: 'user@example.com' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // NODE_ENV is not 'production' in test runner → raw token returned
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);
        expect(fakeUser.save).toHaveBeenCalled();
        expect(fakeUser.resetTokenHash).not.toBeNull();
    });

    // ── reset-password ───────────────────────────────────────────────────────

    it('POST /auth/reset-password — missing fields returns 400', async () => {
        const res = await request(app).post('/auth/reset-password').send({ token: 'tok' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('POST /auth/reset-password — weak password returns 400', async () => {
        const res = await request(app)
            .post('/auth/reset-password')
            .send({ token: 'tok', newPassword: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('WEAK_PASSWORD');
    });

    it('POST /auth/reset-password — wrong token returns 400 TOKEN_EXPIRED', async () => {
        const User = require('../models/user-model');
        vi.spyOn(User, 'findOne').mockResolvedValue(null); // no matching user
        const res = await request(app)
            .post('/auth/reset-password')
            .send({ token: 'wrong-token-xyz', newPassword: 'NewSecure99!' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('POST /auth/reset-password — valid token clears token and updates password', async () => {
        const User = require('../models/user-model');
        const rawToken = 'valid-raw-token-12345';
        const fakeUser = {
            resetTokenHash:      makeTokenHash(rawToken),
            resetTokenExpiresAt: new Date(Date.now() + 60_000), // 1 min in future
            passwordHash:        'old-hash',
            save:                vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(User, 'findOne').mockResolvedValue(fakeUser);
        const res = await request(app)
            .post('/auth/reset-password')
            .send({ token: rawToken, newPassword: 'NewSecure99!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(fakeUser.resetTokenHash).toBeNull();
        expect(fakeUser.resetTokenExpiresAt).toBeNull();
        expect(fakeUser.passwordHash).not.toBe('old-hash'); // was updated
        expect(fakeUser.save).toHaveBeenCalled();
    });
});
