const DEFAULT_NUM_TEAMS = 12;
const DEFAULT_SCORING_TYPE = '5x5 Roto';
const DEFAULT_DRAFT_TYPE = 'AUCTION';
const DEFAULT_SALARY_CAP = 260;
const DEFAULT_ROSTER_SLOTS = {
    C: 2,
    '1B': 1,
    '2B': 1,
    '3B': 1,
    SS: 1,
    OF: 5,
    UTIL: 1,
    SP: 5,
    RP: 3,
    BENCH: 4
};
const SCORING_TYPES = ['5x5 Roto', 'H2H Categories', 'Points'];

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toPlainObject(value) {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value.entries());
    if (typeof value.toObject === 'function') return value.toObject();
    return value;
}

function buildFilledRosterSlots(rosterSlots = {}) {
    const resolved = toPlainObject(rosterSlots);
    return Object.keys(resolved).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

function normalizePurchasedPlayers(purchasedPlayers) {
    if (!Array.isArray(purchasedPlayers)) return [];
    return purchasedPlayers
        .map((entry) => {
            if (!entry) return null;
            if (typeof entry === 'string') return { playerId: entry, price: 0 };
            if (entry.playerId) {
                return {
                    playerId: String(entry.playerId),
                    price: Number.isFinite(Number(entry.price)) ? Number(entry.price) : 0
                };
            }
            return null;
        })
        .filter(Boolean);
}

function buildTeams(numberOfTeams, salaryCap, rosterSlots, existingTeams = []) {
    const totalTeams = Math.min(Math.max(toPositiveInt(numberOfTeams, DEFAULT_NUM_TEAMS), 2), 30);
    const resolvedSalaryCap = Math.max(toPositiveInt(salaryCap, DEFAULT_SALARY_CAP), 1);

    return Array.from({ length: totalTeams }, (_, index) => {
        const teamId = `fantasy-team-${index + 1}`;
        const existingTeam = existingTeams.find((team) => team.teamId === teamId);
        const existingName = existingTeam?.teamName && String(existingTeam.teamName).trim();

        return {
            teamId,
            teamName: existingName || teamId,
            budgetRemaining: existingTeam != null && existingTeam.budgetRemaining != null
                ? Number(existingTeam.budgetRemaining)
                : resolvedSalaryCap,
            purchasedPlayers: normalizePurchasedPlayers(existingTeam?.purchasedPlayers),
            filledRosterSlots: existingTeam?.filledRosterSlots != null
                ? toPlainObject(existingTeam.filledRosterSlots)
                : buildFilledRosterSlots(rosterSlots)
        };
    });
}

function sanitizeRosterSlots(input = {}) {
    const resolvedInput = toPlainObject(input);
    const rosterSlots = {};
    Object.keys(DEFAULT_ROSTER_SLOTS).forEach((slot) => {
        rosterSlots[slot] = Math.max(Number.parseInt(resolvedInput[slot], 10) || 0, 0);
    });
    return rosterSlots;
}

function sanitizeLeagueSettings(input = {}, fallback = {}) {
    const resolvedInput = toPlainObject(input);
    const resolvedFallback = toPlainObject(fallback);
    const rosterSlots = sanitizeRosterSlots(resolvedInput.rosterSlots || resolvedFallback.rosterSlots || DEFAULT_ROSTER_SLOTS);
    const scoringType = SCORING_TYPES.includes(resolvedInput.scoringType)
        ? resolvedInput.scoringType
        : (resolvedFallback.scoringType || DEFAULT_SCORING_TYPE);

    return {
        numberOfTeams: Math.min(Math.max(toPositiveInt(resolvedInput.numberOfTeams, resolvedFallback.numberOfTeams || DEFAULT_NUM_TEAMS), 2), 30),
        salaryCap: Math.max(toPositiveInt(resolvedInput.salaryCap, resolvedFallback.salaryCap || DEFAULT_SALARY_CAP), 1),
        rosterSlots,
        scoringType,
        draftType: DEFAULT_DRAFT_TYPE
    };
}

function generateDraftSessionId() {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeSession(session) {
    if (!session) return null;
    const plain = typeof session.toObject === 'function' ? session.toObject() : session;

    const purchasedPlayerIds = plain.purchasedPlayerIds && plain.purchasedPlayerIds.length > 0
        ? plain.purchasedPlayerIds
        : (plain.draftHistory || []).map((e) => e.playerId);

    return {
        draftSessionId: plain.draftSessionId,
        name: plain.name || '',
        status: plain.status || 'setup',
        myTeamId: plain.myTeamId || null,
        nominationOrder: plain.nominationOrder || 0,
        leagueId: String(plain.leagueId),
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
        pooledAt: plain.pooledAt || null,
        leagueSettings: {
            ...plain.leagueSettings,
            rosterSlots: toPlainObject(plain.leagueSettings?.rosterSlots)
        },
        teams: (plain.teams || []).map((team) => ({
            teamId: team.teamId,
            teamName: team.teamName,
            budgetRemaining: team.budgetRemaining,
            purchasedPlayers: (team.purchasedPlayers || []).map((p) => ({
                playerId: p.playerId,
                price: p.price
            })),
            filledRosterSlots: toPlainObject(team.filledRosterSlots)
        })),
        availablePlayerIds: plain.availablePlayerIds || [],
        purchasedPlayerIds,
        draftHistory: (plain.draftHistory || []).map((entry) => ({
            purchaseId: entry.purchaseId,
            playerId: entry.playerId,
            playerName: entry.playerName,
            teamId: entry.teamId,
            price: entry.price,
            positionFilled: entry.positionFilled || null,
            timestamp: entry.timestamp,
            nominationOrder: entry.nominationOrder,
        })),
    };
}

module.exports = {
    DEFAULT_NUM_TEAMS,
    DEFAULT_SCORING_TYPE,
    DEFAULT_DRAFT_TYPE,
    DEFAULT_SALARY_CAP,
    DEFAULT_ROSTER_SLOTS,
    SCORING_TYPES,
    toPositiveInt,
    toPlainObject,
    buildFilledRosterSlots,
    normalizePurchasedPlayers,
    buildTeams,
    sanitizeRosterSlots,
    sanitizeLeagueSettings,
    generateDraftSessionId,
    serializeSession
};
