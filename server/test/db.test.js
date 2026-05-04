const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const db = require('../db');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_CONNECT = mongoServer.getUri();
    await db.init();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    // Clear all collections between tests
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// ── User CRUD ─────────────────────────────────────────────────────────────────

describe('User CRUD', () => {
    test('createUser and getUserByEmail', async () => {
        await db.createUser({
            userName: 'alice',
            email: 'alice@test.com',
            passwordHash: 'hash123'
        });

        const found = await db.getUserByEmail('alice@test.com');
        expect(found).not.toBeNull();
        expect(found.userName).toBe('alice');
        expect(found.email).toBe('alice@test.com');
    });

    test('createUser and getUserById', async () => {
        const created = await db.createUser({
            userName: 'bob',
            email: 'bob@test.com',
            passwordHash: 'hash456'
        });

        const found = await db.getUserById(created._id);
        expect(found).not.toBeNull();
        expect(found.email).toBe('bob@test.com');
    });

    test('getUserByEmail returns null for unknown email', async () => {
        const found = await db.getUserByEmail('nobody@test.com');
        expect(found).toBeNull();
    });

    test('deleteUser removes the user', async () => {
        const created = await db.createUser({
            userName: 'carol',
            email: 'carol@test.com',
            passwordHash: 'hash789'
        });

        await db.deleteUser(created._id.toString());

        const found = await db.getUserById(created._id.toString());
        expect(found).toBeNull();
    });

    test('updateUser changes userName and avatar', async () => {
        const created = await db.createUser({
            userName: 'dave',
            email: 'dave@test.com',
            passwordHash: 'hashxxx'
        });

        const updated = await db.updateUser(created._id.toString(), {
            userName: 'david',
            avatar: 'avatar-2'
        });

        expect(updated.userName).toBe('david');
        expect(updated.avatar).toBe('avatar-2');
    });
});

// ── League CRUD ───────────────────────────────────────────────────────────────

describe('League CRUD', () => {
    let ownerId;

    beforeEach(async () => {
        const user = await db.createUser({
            userName: 'owner',
            email: 'owner@test.com',
            passwordHash: 'h'
        });
        ownerId = user._id.toString();
    });

    test('createLeague and getLeaguesForUser', async () => {
        await db.createLeague(ownerId, { name: 'My League' });

        const leagues = await db.getLeaguesForUser(ownerId);
        expect(leagues).toHaveLength(1);
        expect(leagues[0].name).toBe('My League');
    });

    test('getLeagueById returns the correct league', async () => {
        const created = await db.createLeague(ownerId, { name: 'Find Me' });

        const found = await db.getLeagueById(created._id);
        expect(found).not.toBeNull();
        expect(found.name).toBe('Find Me');
    });

    test('deleteLeagueById removes the league', async () => {
        const created = await db.createLeague(ownerId, { name: 'Delete Me' });

        await db.deleteLeagueById(created._id);

        const found = await db.getLeagueById(created._id);
        expect(found).toBeNull();
    });

    test('getLeaguesForUser returns only leagues for that user', async () => {
        const other = await db.createUser({
            userName: 'stranger',
            email: 'stranger@test.com',
            passwordHash: 'h2'
        });

        await db.createLeague(ownerId, { name: 'Owner League' });
        await db.createLeague(other._id.toString(), { name: 'Other League' });

        const leagues = await db.getLeaguesForUser(ownerId);
        expect(leagues).toHaveLength(1);
        expect(leagues[0].name).toBe('Owner League');
    });
});
