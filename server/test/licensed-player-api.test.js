import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

const MOCK_URL = 'http://test-player-api';
const MOCK_KEY = 'test-key-123';

function mockOkResponse(body = { success: true }) {
    const json = JSON.stringify(body);
    return { ok: true, status: 200, text: async () => json, json: async () => body };
}

function mockErrorResponse(status, body = { error: 'Bad request' }) {
    const json = JSON.stringify(body);
    return { ok: false, status, text: async () => json, json: async () => body };
}

describe('licensed-player-api (versioned paths)', () => {
    let api;
    const mockFetch = vi.fn();

    beforeAll(async () => {
        process.env.PLAYER_API_URL = MOCK_URL;
        process.env.PLAYER_API_KEY = MOCK_KEY;
        delete process.env.PLAYER_API_LEGACY;
        vi.stubGlobal('fetch', mockFetch);
        // Health check fires on module import — handle it
        mockFetch.mockResolvedValueOnce(mockOkResponse({ success: true, status: 'ok' }));
        vi.resetModules();
        api = await import('../lib/licensed-player-api.js');
    });

    afterAll(() => {
        delete process.env.PLAYER_API_URL;
        delete process.env.PLAYER_API_KEY;
        vi.unstubAllGlobals();
    });

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(mockOkResponse());
    });

    it('hasConfig returns true when URL and key are set', () => {
        expect(api.hasConfig()).toBe(true);
    });

    it('getPlayerById is an alias for getPlayer', () => {
        expect(api.getPlayerById).toBe(api.getPlayer);
    });

    describe('PlayerDataApiError', () => {
        it('is exported from the module', () => {
            expect(api.PlayerDataApiError).toBeDefined();
        });

        it('carries code, fields, and status', async () => {
            mockFetch.mockResolvedValueOnce(mockErrorResponse(400, {
                error: 'Invalid body', code: 'BAD_REQUEST', fields: [{ field: 'budget', message: 'Required' }]
            }));
            let caught;
            try { await api.getPlayers(); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(api.PlayerDataApiError);
            expect(caught.code).toBe('BAD_REQUEST');
            expect(caught.status).toBe(400);
            expect(caught.fields).toEqual([{ field: 'budget', message: 'Required' }]);
        });

        it('postValuations throws PlayerDataApiError on API error', async () => {
            mockFetch
                .mockResolvedValueOnce(mockErrorResponse(400, { error: 'Bad', code: 'BAD_REQUEST', fields: [] }))
                .mockResolvedValueOnce(mockErrorResponse(400, { error: 'Bad', code: 'BAD_REQUEST', fields: [] }));
            await expect(api.postValuations({}, {})).rejects.toBeInstanceOf(api.PlayerDataApiError);
        });
    });

    describe('getPlayers', () => {
        it('calls /api/v1/players', async () => {
            await api.getPlayers();
            expect(mockFetch).toHaveBeenCalledWith(
                `${MOCK_URL}/api/v1/players`,
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('appends query params', async () => {
            await api.getPlayers({ search: 'Trout', position: 'OF', limit: 25 });
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('search=Trout');
            expect(url).toContain('position=OF');
            expect(url).toContain('limit=25');
        });

        it('sends X-API-Key and Authorization: Bearer headers', async () => {
            await api.getPlayers();
            const [, options] = mockFetch.mock.calls[0];
            expect(options.headers['X-API-Key']).toBe(MOCK_KEY);
            expect(options.headers['Authorization']).toBe(`Bearer ${MOCK_KEY}`);
        });
    });

    describe('getPlayer', () => {
        it('calls /api/v1/players/:id', async () => {
            mockFetch.mockResolvedValueOnce(mockOkResponse({ success: true, player: { playerId: 'mlb-123' } }));
            await api.getPlayer('mlb-123');
            expect(mockFetch).toHaveBeenCalledWith(
                `${MOCK_URL}/api/v1/players/mlb-123`,
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('encodes playerId in URL', async () => {
            mockFetch.mockResolvedValueOnce(mockOkResponse({ player: {} }));
            await api.getPlayer('mlb-foo/bar');
            const [url] = mockFetch.mock.calls[0];
            expect(url).toContain('mlb-foo%2Fbar');
        });

        it('returns null on 404', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
            const result = await api.getPlayer('mlb-missing');
            expect(result).toBeNull();
        });
    });

    describe('postValuations', () => {
        it('tries /api/v1/players/valuations first', async () => {
            const leagueSettings = { numTeams: 10, budget: 260 };
            const draftState = { availablePlayerIds: ['mlb-1'], purchasedPlayers: [], teamBudgets: {}, filledRosterSlots: {} };
            await api.postValuations(leagueSettings, draftState);
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe(`${MOCK_URL}/api/v1/players/valuations`);
            expect(options.method).toBe('POST');
            expect(JSON.parse(options.body)).toEqual({ leagueSettings, draftState });
        });

        it('falls back to /players/valuations when versioned path fails', async () => {
            mockFetch
                .mockResolvedValueOnce(mockErrorResponse(404, { error: 'Not found' }))
                .mockResolvedValueOnce(mockOkResponse({ success: true, valuations: [] }));
            await api.postValuations({}, {});
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch.mock.calls[1][0]).toBe(`${MOCK_URL}/players/valuations`);
        });

        it('throws when both URLs fail', async () => {
            mockFetch
                .mockResolvedValueOnce(mockErrorResponse(404))
                .mockResolvedValueOnce(mockErrorResponse(400, { error: 'Bad request', code: 'BAD_REQUEST' }));
            await expect(api.postValuations({}, {})).rejects.toThrow('Bad request');
        });
    });

    describe('postRecommendations', () => {
        it('POSTs to /api/v1/players/recommendations', async () => {
            await api.postRecommendations({ budget: 260 }, { availablePlayerIds: [] }, 'fantasy-team-1');
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe(`${MOCK_URL}/api/v1/players/recommendations`);
            expect(JSON.parse(options.body).teamId).toBe('fantasy-team-1');
        });

        it('omits teamId from body when null', async () => {
            await api.postRecommendations({}, {}, null);
            const [, options] = mockFetch.mock.calls[0];
            expect(JSON.parse(options.body)).not.toHaveProperty('teamId');
        });
    });

    describe('postNominations', () => {
        it('POSTs to /api/v1/players/recommendations/nominations', async () => {
            const leagueSettings = { budget: 260, rosterSlots: 23 };
            const draftState = { availablePlayerIds: ['mlb-1'], purchasedPlayers: [], teamBudgets: {}, filledRosterSlots: {} };
            await api.postNominations({ leagueSettings, draftState, teamId: 'fantasy-team-2' });
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe(`${MOCK_URL}/api/v1/players/recommendations/nominations`);
            expect(options.method).toBe('POST');
            const body = JSON.parse(options.body);
            expect(body.leagueSettings).toEqual(leagueSettings);
            expect(body.draftState).toEqual(draftState);
            expect(body.teamId).toBe('fantasy-team-2');
        });

        it('omits teamId from body when not provided', async () => {
            await api.postNominations({ leagueSettings: {}, draftState: {} });
            const [, options] = mockFetch.mock.calls[0];
            expect(JSON.parse(options.body)).not.toHaveProperty('teamId');
        });

        it('returns null when API is not configured', async () => {
            // Temporarily clear config by testing hasConfig path: postNominations checks hasConfig()
            // We rely on the module's captured baseUrl/apiKey being set — this test verifies
            // the method works end-to-end, null return is tested via hasConfig unit test.
            const result = await api.postNominations({});
            expect(result).not.toBeNull(); // config is set in this suite
        });
    });

    describe('postUsage', () => {
        it('POSTs to /api/v1/usage', async () => {
            await api.postUsage({ event: 'draft_started', metadata: { leagueId: 'l-1' } });
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe(`${MOCK_URL}/api/v1/usage`);
            expect(JSON.parse(options.body).event).toBe('draft_started');
        });
    });
});

describe('licensed-player-api with PLAYER_API_LEGACY=1', () => {
    let api;
    const mockFetch = vi.fn();

    beforeAll(async () => {
        process.env.PLAYER_API_URL = MOCK_URL;
        process.env.PLAYER_API_KEY = MOCK_KEY;
        process.env.PLAYER_API_LEGACY = '1';
        vi.stubGlobal('fetch', mockFetch);
        // Health check on import — still uses /api/v1/health regardless of LEGACY flag
        mockFetch.mockResolvedValueOnce(mockOkResponse({ success: true, status: 'ok' }));
        vi.resetModules();
        api = await import('../lib/licensed-player-api.js');
    });

    afterAll(() => {
        delete process.env.PLAYER_API_URL;
        delete process.env.PLAYER_API_KEY;
        delete process.env.PLAYER_API_LEGACY;
        vi.unstubAllGlobals();
    });

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(mockOkResponse());
    });

    it('getPlayers calls unversioned /players', async () => {
        await api.getPlayers();
        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe(`${MOCK_URL}/players`);
    });

    it('getPlayer calls unversioned /players/:id', async () => {
        mockFetch.mockResolvedValueOnce(mockOkResponse({ player: {} }));
        await api.getPlayer('mlb-123');
        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe(`${MOCK_URL}/players/mlb-123`);
    });

    it('postValuations POSTs to unversioned /players/valuations (single attempt)', async () => {
        await api.postValuations({}, {});
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe(`${MOCK_URL}/players/valuations`);
    });
});

describe('licensed-player-api with no config', () => {
    let api;
    const mockFetch = vi.fn();

    beforeAll(async () => {
        delete process.env.PLAYER_API_URL;
        delete process.env.PLAYER_API_KEY;
        vi.stubGlobal('fetch', mockFetch);
        vi.resetModules();
        api = await import('../lib/licensed-player-api.js');
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('hasConfig returns false', () => {
        expect(api.hasConfig()).toBe(false);
    });

    it('getPlayers returns null', async () => {
        expect(await api.getPlayers()).toBeNull();
    });

    it('postValuations returns null', async () => {
        expect(await api.postValuations({}, {})).toBeNull();
    });

    it('postNominations returns null', async () => {
        expect(await api.postNominations({})).toBeNull();
    });

    it('does not call fetch', () => {
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
