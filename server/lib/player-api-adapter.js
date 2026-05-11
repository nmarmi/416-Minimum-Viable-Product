const {
    DEFAULT_NUM_TEAMS,
    DEFAULT_SALARY_CAP,
    toPlainObject
} = require('../services/draft-defaults');

const PITCHER_SLOT_KEYS = new Set(['SP', 'RP', 'P']);
const BENCH_SLOT_KEYS = new Set(['BENCH', 'BN']);

function computeRosterSlotCounts(rosterSlots) {
    let hitterSlotsPerTeam = 0;
    let pitcherSlotsPerTeam = 0;
    for (const [pos, count] of Object.entries(rosterSlots)) {
        const n = Number(count || 0);
        const key = pos.toUpperCase();
        if (PITCHER_SLOT_KEYS.has(key)) {
            pitcherSlotsPerTeam += n;
        } else if (!BENCH_SLOT_KEYS.has(key)) {
            hitterSlotsPerTeam += n;
        }
    }
    return { hitterSlotsPerTeam, pitcherSlotsPerTeam };
}

/**
 * Maps DraftSession.leagueSettings to the shape the Player Data API expects.
 * forValuations=true  → { numTeams, budget, hitterBudgetPct, hitterSlotsPerTeam, pitcherSlotsPerTeam, statSeason }
 * forValuations=false → { budget, rosterSlots: <total slot count> }
 */
function toPlayerApiLeagueSettings(leagueSettings, { forValuations = true } = {}) {
    const rosterSlots = toPlainObject(leagueSettings?.rosterSlots || {});
    const budget = leagueSettings?.salaryCap || DEFAULT_SALARY_CAP;

    if (forValuations) {
        const { hitterSlotsPerTeam, pitcherSlotsPerTeam } = computeRosterSlotCounts(rosterSlots);
        return {
            numTeams: leagueSettings?.numberOfTeams || DEFAULT_NUM_TEAMS,
            budget,
            hitterBudgetPct: 0.675,
            hitterSlotsPerTeam,
            pitcherSlotsPerTeam,
            statSeason: new Date().getFullYear()
        };
    }

    const totalRosterSlots = Object.values(rosterSlots).reduce((s, n) => s + Number(n || 0), 0);
    return { budget, rosterSlots: totalRosterSlots };
}

/**
 * Maps a DraftSession document to the draftState payload the Player Data API expects.
 * Returns: { availablePlayerIds, purchasedPlayers, teamBudgets, filledRosterSlots }
 * No Mongoose internals or _id fields leak into the output.
 */
function toPlayerApiDraftState(session) {
    const availablePlayerIds = session.availablePlayerIds || [];

    const purchasedPlayers = (session.draftHistory || []).map((entry) => ({
        playerId: entry.playerId,
        teamId: entry.teamId,
        price: entry.price,
        positionFilled: entry.positionFilled || null
    }));

    const teamBudgets = {};
    const filledRosterSlots = {};
    for (const team of (session.teams || [])) {
        teamBudgets[team.teamId] = team.budgetRemaining ?? 0;
        filledRosterSlots[team.teamId] = toPlainObject(team.filledRosterSlots) || {};
    }

    return { availablePlayerIds, purchasedPlayers, teamBudgets, filledRosterSlots };
}

module.exports = { toPlayerApiLeagueSettings, toPlayerApiDraftState };
