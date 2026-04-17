const DraftSession = require('../models/draft-session-model');
const Player = require('../models/player-model');
const licensedApi = require('../lib/licensed-player-api');

const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P']);
// Statuses that reject any draft mutations. US-7.4 may narrow this further to
// require `active` specifically, but Epic 2 only requires blocking finished /
// paused drafts so existing setup-phase flows keep working.
const MUTATION_BLOCKED_STATUSES = new Set(['completed', 'paused']);

function toPlainObject(value) {
    if (!value) return {};
    if (value instanceof Map) return Object.fromEntries(value.entries());
    if (typeof value.toObject === 'function') return value.toObject();
    return value;
}

/**
 * Returns the best slot key to fill for the given position string, or null if
 * no slot is open. Position may be a comma-delimited multi-eligibility string
 * (e.g. "OF,1B", "2B,SS"). Priority per candidate: exact slot → UTIL (batters
 * only) → BENCH. Candidates are tried in the order they appear in the string.
 */
function findSlotForPosition(rosterSlots, filledSlots, position) {
    const candidates = position ? position.split(',').map((p) => p.trim()).filter(Boolean) : [];

    for (const pos of candidates) {
        if (rosterSlots[pos] != null && (filledSlots[pos] || 0) < rosterSlots[pos]) {
            return pos;
        }
    }

    const isPitcher = candidates.length > 0 && candidates.every((p) => PITCHER_POSITIONS.has(p));
    if (!isPitcher && candidates.length > 0 &&
        rosterSlots['UTIL'] != null && (filledSlots['UTIL'] || 0) < rosterSlots['UTIL']) {
        return 'UTIL';
    }

    if (rosterSlots['BENCH'] != null && (filledSlots['BENCH'] || 0) < rosterSlots['BENCH']) {
        return 'BENCH';
    }

    return null;
}

function countFilledSlots(filledSlots) {
    return Object.values(filledSlots || {}).reduce((sum, n) => sum + Number(n || 0), 0);
}

function countTotalSlots(rosterSlots) {
    return Object.values(rosterSlots || {}).reduce((sum, n) => sum + Number(n || 0), 0);
}

function buildSnapshotTeam(team) {
    const filled = toPlainObject(team.filledRosterSlots);
    return {
        teamId: team.teamId,
        teamName: team.teamName,
        budgetRemaining: team.budgetRemaining,
        purchasedPlayers: (team.purchasedPlayers || []).map((entry) => ({
            playerId: entry.playerId,
            price: entry.price
        })),
        filledRosterSlots: filled
    };
}

async function resolvePlayerMeta(playerId, providedName) {
    let playerName = providedName;
    let position = null;

    const dbPlayer = await Player.findOne({ playerId }).lean();
    if (dbPlayer) {
        playerName = playerName || dbPlayer.playerName;
        position = dbPlayer.position || null;
        return { playerName, position };
    }

    if (licensedApi.hasConfig()) {
        const apiPlayer = await licensedApi.getPlayer(playerId);
        if (apiPlayer) {
            playerName = playerName || apiPlayer.playerName || apiPlayer.name;
            const positions = Array.isArray(apiPlayer.positions) && apiPlayer.positions.length > 0
                ? apiPlayer.positions
                : (apiPlayer.position ? [apiPlayer.position] : []);
            position = positions.join(',') || null;
        }
        return { playerName, position };
    }

    if (playerName) {
        const namePlayer = await Player.findOne({ playerName: playerName.trim() }).lean();
        if (namePlayer) {
            position = namePlayer.position || null;
        }
    }

    return { playerName, position };
}

/**
 * US-2.5: Initialize a draft session — set all team budgets to the cap, zero
 * out filled roster slots, mark `availablePlayerIds` as untouched pool, and
 * flip status to `active`. Callers are responsible for populating the pool
 * beforehand (see US-3.2 / US-8.4).
 */
async function initializeDraft(draftSessionId) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    if (session.status === 'active') {
        return { success: false, errorMessage: 'Draft session is already active.' };
    }

    const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots);
    const salaryCap = Number(session.leagueSettings?.salaryCap) || 0;

    session.teams.forEach((team) => {
        team.budgetRemaining = salaryCap;
        team.purchasedPlayers = [];
        team.filledRosterSlots = new Map(Object.keys(rosterSlots).map((key) => [key, 0]));
    });

    session.purchasedPlayerIds = [];
    session.draftHistory = [];
    session.nominationOrder = 0;
    session.status = 'active';

    session.markModified('teams');
    await session.save();

    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-2.6: Record a purchase against an active draft session atomically.
 * Validates availability, budget (with $1-per-open-slot reserve), and roster
 * capacity. On success, moves the player from available to purchased, debits
 * the team, appends to history, and bumps `nominationOrder`.
 */
async function recordPurchase(draftSessionId, { playerId, playerName, teamId, price }) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    if (MUTATION_BLOCKED_STATUSES.has(session.status)) {
        return { success: false, errorMessage: 'Draft is not active.' };
    }

    const playerIdStr = String(playerId);

    if (!session.availablePlayerIds.includes(playerIdStr)) {
        return { success: false, errorMessage: 'Player is not available.' };
    }

    const team = session.teams.find((t) => t.teamId === teamId);
    if (!team) {
        return { success: false, errorMessage: 'Team not found in this session.' };
    }

    const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots);
    const filledSlots = toPlainObject(team.filledRosterSlots);
    const totalSlots = countTotalSlots(rosterSlots);
    const totalFilled = countFilledSlots(filledSlots);
    const openSlots = totalSlots - totalFilled;

    if (openSlots <= 0) {
        return { success: false, errorMessage: 'Team roster is full.' };
    }

    // $1 minimum reserve for each remaining unfilled slot after this purchase.
    const maxBid = team.budgetRemaining - (openSlots - 1);
    if (price > maxBid) {
        return { success: false, errorMessage: 'Team has insufficient budget.' };
    }

    const { playerName: resolvedName, position } = await resolvePlayerMeta(playerIdStr, playerName);
    const finalName = resolvedName || playerIdStr;

    const slotKey = findSlotForPosition(rosterSlots, filledSlots, position);

    session.availablePlayerIds = session.availablePlayerIds.filter((id) => id !== playerIdStr);
    session.purchasedPlayerIds.push(playerIdStr);

    team.budgetRemaining -= price;
    team.purchasedPlayers.push({ playerId: playerIdStr, price });

    if (slotKey) {
        team.filledRosterSlots.set(slotKey, (team.filledRosterSlots.get(slotKey) || 0) + 1);
    }

    session.nominationOrder = (session.nominationOrder || 0) + 1;
    session.draftHistory.push({
        purchaseId: DraftSession.generatePurchaseId(),
        playerId: playerIdStr,
        playerName: finalName,
        teamId,
        price,
        positionFilled: slotKey,
        nominationOrder: session.nominationOrder
    });

    session.markModified('teams');
    await session.save();

    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-2.7: Undo a purchase by purchaseId — restore availability, refund the
 * team, free the roster slot, and drop the history entry.
 */
async function undoPurchase(draftSessionId, purchaseId) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    if (MUTATION_BLOCKED_STATUSES.has(session.status)) {
        return { success: false, errorMessage: 'Draft is not active.' };
    }

    const entry = session.draftHistory.find((h) => h.purchaseId === purchaseId);
    if (!entry) {
        return { success: false, errorMessage: 'Purchase not found.' };
    }

    const team = session.teams.find((t) => t.teamId === entry.teamId);
    if (!team) {
        return { success: false, errorMessage: 'Team for this purchase no longer exists.' };
    }

    session.purchasedPlayerIds = session.purchasedPlayerIds.filter((id) => id !== entry.playerId);
    if (!session.availablePlayerIds.includes(entry.playerId)) {
        session.availablePlayerIds.push(entry.playerId);
    }

    team.budgetRemaining += entry.price;
    team.purchasedPlayers = team.purchasedPlayers.filter((p) => p.playerId !== entry.playerId);

    if (entry.positionFilled) {
        const current = team.filledRosterSlots.get(entry.positionFilled) || 0;
        team.filledRosterSlots.set(entry.positionFilled, Math.max(current - 1, 0));
    }

    session.draftHistory = session.draftHistory.filter((h) => h.purchaseId !== purchaseId);

    session.markModified('teams');
    await session.save();

    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-2.8: Edit an existing purchase — change price and/or team. Adjusts both
 * teams' budgets and roster slots as needed and validates the new values.
 */
async function editPurchase(draftSessionId, purchaseId, { newPrice, newTeamId } = {}) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    if (MUTATION_BLOCKED_STATUSES.has(session.status)) {
        return { success: false, errorMessage: 'Draft is not active.' };
    }

    const entry = session.draftHistory.find((h) => h.purchaseId === purchaseId);
    if (!entry) {
        return { success: false, errorMessage: 'Purchase not found.' };
    }

    const oldTeam = session.teams.find((t) => t.teamId === entry.teamId);
    if (!oldTeam) {
        return { success: false, errorMessage: 'Original team for this purchase no longer exists.' };
    }

    const targetTeamId = newTeamId || entry.teamId;
    const newTeam = targetTeamId === entry.teamId
        ? oldTeam
        : session.teams.find((t) => t.teamId === targetTeamId);

    if (!newTeam) {
        return { success: false, errorMessage: 'Target team not found in this session.' };
    }

    const finalPrice = Number.isFinite(Number(newPrice)) ? Number(newPrice) : entry.price;
    if (finalPrice < 1 || !Number.isInteger(finalPrice)) {
        return { success: false, errorMessage: 'Price must be a whole number of at least $1.' };
    }

    const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots);

    // Refund old team first so budget math is correct when old===new.
    oldTeam.budgetRemaining += entry.price;
    oldTeam.purchasedPlayers = oldTeam.purchasedPlayers.filter((p) => p.playerId !== entry.playerId);
    if (entry.positionFilled) {
        const prev = oldTeam.filledRosterSlots.get(entry.positionFilled) || 0;
        oldTeam.filledRosterSlots.set(entry.positionFilled, Math.max(prev - 1, 0));
    }

    const newFilledSlots = toPlainObject(newTeam.filledRosterSlots);
    const totalSlots = countTotalSlots(rosterSlots);
    const totalFilled = countFilledSlots(newFilledSlots);
    const openSlotsAfterRefund = totalSlots - totalFilled;

    if (openSlotsAfterRefund <= 0) {
        // Roll back the refund before bailing out.
        oldTeam.budgetRemaining -= entry.price;
        oldTeam.purchasedPlayers.push({ playerId: entry.playerId, price: entry.price });
        if (entry.positionFilled) {
            const prev = oldTeam.filledRosterSlots.get(entry.positionFilled) || 0;
            oldTeam.filledRosterSlots.set(entry.positionFilled, prev + 1);
        }
        return { success: false, errorMessage: 'Target team roster is full.' };
    }

    const maxBid = newTeam.budgetRemaining - (openSlotsAfterRefund - 1);
    if (finalPrice > maxBid) {
        oldTeam.budgetRemaining -= entry.price;
        oldTeam.purchasedPlayers.push({ playerId: entry.playerId, price: entry.price });
        if (entry.positionFilled) {
            const prev = oldTeam.filledRosterSlots.get(entry.positionFilled) || 0;
            oldTeam.filledRosterSlots.set(entry.positionFilled, prev + 1);
        }
        return { success: false, errorMessage: 'Target team has insufficient budget for the new price.' };
    }

    let finalPositionFilled = entry.positionFilled;
    if (targetTeamId !== entry.teamId) {
        const { position } = await resolvePlayerMeta(entry.playerId, entry.playerName);
        finalPositionFilled = findSlotForPosition(rosterSlots, newFilledSlots, position);
    }

    newTeam.budgetRemaining -= finalPrice;
    newTeam.purchasedPlayers.push({ playerId: entry.playerId, price: finalPrice });
    if (finalPositionFilled) {
        newTeam.filledRosterSlots.set(
            finalPositionFilled,
            (newTeam.filledRosterSlots.get(finalPositionFilled) || 0) + 1
        );
    }

    entry.teamId = targetTeamId;
    entry.price = finalPrice;
    entry.positionFilled = finalPositionFilled;

    session.markModified('teams');
    session.markModified('draftHistory');
    await session.save();

    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-2.9: Return a plain snapshot of the current draft state — teams, history,
 * and availability. Views render from this rather than from the Mongoose doc.
 */
function buildSnapshot(session) {
    if (!session) return null;
    const plain = typeof session.toObject === 'function' ? session.toObject() : session;

    const purchasedPlayerIds = plain.purchasedPlayerIds && plain.purchasedPlayerIds.length > 0
        ? plain.purchasedPlayerIds
        : (plain.draftHistory || []).map((entry) => entry.playerId);

    return {
        draftSessionId: plain.draftSessionId,
        name: plain.name || '',
        status: plain.status || 'setup',
        myTeamId: plain.myTeamId || null,
        nominationOrder: plain.nominationOrder || 0,
        leagueSettings: {
            ...plain.leagueSettings,
            rosterSlots: toPlainObject(plain.leagueSettings?.rosterSlots)
        },
        teams: (plain.teams || []).map(buildSnapshotTeam),
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
            nominationOrder: entry.nominationOrder
        }))
    };
}

async function getDraftSnapshot(draftSessionId) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }
    return { success: true, session, snapshot: buildSnapshot(session) };
}

module.exports = {
    initializeDraft,
    recordPurchase,
    undoPurchase,
    editPurchase,
    getDraftSnapshot,
    buildSnapshot
};
