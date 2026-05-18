import { toPlayerApiLeagueSettings, toPlayerApiDraftState } from '../lib/player-api-adapter.js';

const BASE_LEAGUE_SETTINGS = {
    numberOfTeams: 10,
    salaryCap: 260,
    rosterSlots: { C: 2, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 5, UTIL: 1, SP: 5, RP: 3, BENCH: 4 },
    scoringType: '5x5 Roto',
    draftType: 'AUCTION'
};

describe('toPlayerApiLeagueSettings', () => {
    it('forValuations=true produces numTeams/budget/hitter+pitcher slots', () => {
        const result = toPlayerApiLeagueSettings(BASE_LEAGUE_SETTINGS, { forValuations: true });
        expect(result.numTeams).toBe(10);
        expect(result.budget).toBe(260);
        expect(result.hitterBudgetPct).toBe(0.675);
        // C(2)+1B+2B+3B+SS+OF(5)+UTIL = 12 hitter slots; SP(5)+RP(3) = 8 pitcher slots
        expect(result.hitterSlotsPerTeam).toBe(12);
        expect(result.pitcherSlotsPerTeam).toBe(8);
        expect(result.statSeason).toBeUndefined();
    });

    it('forValuations=false produces numTeams/budget/hitter+pitcher slots (no flat rosterSlots)', () => {
        const result = toPlayerApiLeagueSettings(BASE_LEAGUE_SETTINGS, { forValuations: false });
        expect(result.numTeams).toBe(10);
        expect(result.budget).toBe(260);
        // C(2)+1B+2B+3B+SS+OF(5)+UTIL = 12 hitter slots; SP(5)+RP(3) = 8 pitcher slots; BENCH excluded
        expect(result.hitterSlotsPerTeam).toBe(12);
        expect(result.pitcherSlotsPerTeam).toBe(8);
        expect(result.rosterSlots).toBeUndefined();
        expect(result.hitterBudgetPct).toBeUndefined();
    });

    it('falls back to defaults when leagueSettings is empty', () => {
        const result = toPlayerApiLeagueSettings({}, { forValuations: true });
        expect(result.numTeams).toBe(12);
        expect(result.budget).toBe(260);
        expect(result.hitterSlotsPerTeam).toBe(0);
        expect(result.pitcherSlotsPerTeam).toBe(0);
    });

    it('handles rosterSlots as a Mongoose Map', () => {
        const map = new Map([['SP', 5], ['RP', 3], ['OF', 5], ['1B', 1]]);
        const result = toPlayerApiLeagueSettings(
            { ...BASE_LEAGUE_SETTINGS, rosterSlots: map },
            { forValuations: true }
        );
        expect(result.pitcherSlotsPerTeam).toBe(8);
        expect(result.hitterSlotsPerTeam).toBe(6); // OF(5)+1B(1)
    });
});

describe('toPlayerApiDraftState', () => {
    it('returns empty arrays/objects when session has no purchases', () => {
        const session = {
            availablePlayerIds: ['mlb-1', 'mlb-2'],
            draftHistory: [],
            teams: [
                { teamId: 'fantasy-team-1', budgetRemaining: 260, filledRosterSlots: new Map() },
                { teamId: 'fantasy-team-2', budgetRemaining: 260, filledRosterSlots: new Map() }
            ]
        };
        const result = toPlayerApiDraftState(session);
        expect(result.availablePlayerIds).toEqual(['mlb-1', 'mlb-2']);
        expect(result.purchasedPlayers).toEqual([]);
        expect(result.teamBudgets).toEqual({ 'fantasy-team-1': 260, 'fantasy-team-2': 260 });
        expect(result.filledRosterSlots).toEqual({ 'fantasy-team-1': {}, 'fantasy-team-2': {} });
    });

    it('builds purchasedPlayers from draftHistory with correct shape', () => {
        const session = {
            availablePlayerIds: [],
            draftHistory: [
                { playerId: 'mlb-1', teamId: 'fantasy-team-1', price: 42, positionFilled: 'OF', purchaseId: 'p-1', playerName: 'Mike Trout', nominationOrder: 1 },
                { playerId: 'mlb-2', teamId: 'fantasy-team-2', price: 10, positionFilled: null, purchaseId: 'p-2', playerName: 'Test Player', nominationOrder: 2 }
            ],
            teams: []
        };
        const result = toPlayerApiDraftState(session);
        expect(result.purchasedPlayers).toEqual([
            { playerId: 'mlb-1', teamId: 'fantasy-team-1', price: 42, positionFilled: 'OF' },
            { playerId: 'mlb-2', teamId: 'fantasy-team-2', price: 10, positionFilled: null }
        ]);
        // No internal fields leak
        expect(result.purchasedPlayers[0].purchaseId).toBeUndefined();
        expect(result.purchasedPlayers[0].playerName).toBeUndefined();
        expect(result.purchasedPlayers[0].nominationOrder).toBeUndefined();
    });

    it('builds teamBudgets and filledRosterSlots from teams[]', () => {
        const session = {
            availablePlayerIds: [],
            draftHistory: [],
            teams: [
                {
                    teamId: 'fantasy-team-1',
                    budgetRemaining: 218,
                    filledRosterSlots: new Map([['OF', 1], ['SP', 2]])
                }
            ]
        };
        const result = toPlayerApiDraftState(session);
        expect(result.teamBudgets).toEqual({ 'fantasy-team-1': 218 });
        expect(result.filledRosterSlots['fantasy-team-1']).toEqual({ OF: 1, SP: 2 });
    });

    it('handles missing teams and draftHistory gracefully', () => {
        const session = {};
        const result = toPlayerApiDraftState(session);
        expect(result.availablePlayerIds).toEqual([]);
        expect(result.purchasedPlayers).toEqual([]);
        expect(result.teamBudgets).toEqual({});
        expect(result.filledRosterSlots).toEqual({});
    });
});
