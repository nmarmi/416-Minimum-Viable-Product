const DraftSession = require('../models/draft-session-model');
const Player = require('../models/player-model');
const licensedApi = require('../lib/licensed-player-api');

const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P']);
// US-7.4: every mutation requires `status === 'active'`. Setup-phase sessions
// reject purchases (the explicit `POST /start` action transitions to active);
// paused and completed sessions reject any further mutations.
const MUTATION_REQUIRED_STATUS = 'active';

function rejectInactive(session) {
    if (session.status === MUTATION_REQUIRED_STATUS) return null;
    return { success: false, errorMessage: `Draft is not active (current status: ${session.status}).` };
}

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

    // US-19.2: remove minor league players from the auction pool before processing keepers
    const minorPlayerIds = new Set();
    for (const team of session.teams) {
        for (const minor of (team.minorLeaguePlayers || [])) {
            minorPlayerIds.add(String(minor.playerId));
        }
    }
    if (minorPlayerIds.size > 0) {
        session.availablePlayerIds = session.availablePlayerIds.filter((id) => !minorPlayerIds.has(id));
    }

    // US-18.1: convert keepers into purchases at draft start
    const keeperErrors = [];
    for (const team of session.teams) {
        const keepers = team.keepers || [];
        for (const keeper of keepers) {
            const keeperIdStr = String(keeper.playerId);

            // Validate keeper budget
            const openSlots = countTotalSlots(rosterSlots) - countFilledSlots(toPlainObject(team.filledRosterSlots));
            const maxBid = openSlots > 1 ? team.budgetRemaining - (openSlots - 1) : team.budgetRemaining;
            if (keeper.price > maxBid) {
                keeperErrors.push(`${keeper.playerName} exceeds ${team.teamName}'s budget.`);
                continue;
            }

            // Find and fill the slot
            const slotKey = findSlotForPosition(rosterSlots, toPlainObject(team.filledRosterSlots), keeper.positionAssigned || '');

            team.budgetRemaining -= keeper.price;
            team.purchasedPlayers.push({ playerId: keeperIdStr, price: keeper.price });
            if (slotKey) {
                team.filledRosterSlots.set(slotKey, (team.filledRosterSlots.get(slotKey) || 0) + 1);
            }

            // Remove from available pool
            session.availablePlayerIds = session.availablePlayerIds.filter((id) => id !== keeperIdStr);
            session.purchasedPlayerIds.push(keeperIdStr);
            session.draftHistory.push({
                purchaseId:      DraftSession.generatePurchaseId(),
                playerId:        keeperIdStr,
                playerName:      keeper.playerName,
                teamId:          team.teamId,
                price:           keeper.price,
                positionFilled:  slotKey || null,
                nominationOrder: 0,
                isKeeper:        true,
                contractYears:   keeper.contractYears ?? null,
            });
        }
    }

    session.status = 'active';
    session.markModified('teams');
    await session.save();

    return {
        success: true,
        session,
        snapshot: buildSnapshot(session),
        keeperErrors: keeperErrors.length ? keeperErrors : undefined,
    };
}

/**
 * US-2.6: Record a purchase against an active draft session atomically.
 * Validates availability, budget (with $1-per-open-slot reserve), and roster
 * capacity. On success, moves the player from available to purchased, debits
 * the team, appends to history, and bumps `nominationOrder`.
 */
async function recordPurchase(draftSessionId, { playerId, playerName, teamId, price, notes }) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    const inactive = rejectInactive(session);
    if (inactive) return inactive;

    const playerIdStr = String(playerId);

    // US-7.1: distinguish "already purchased" from generic "not available" so the
    // UI can render an actionable message and tests can assert the specific case.
    if (session.purchasedPlayerIds && session.purchasedPlayerIds.includes(playerIdStr)) {
        return { success: false, errorMessage: 'Player has already been purchased in this draft session.' };
    }

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
        notes: notes || '',
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

    const inactive = rejectInactive(session);
    if (inactive) return inactive;

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
async function editPurchase(draftSessionId, purchaseId, { newPrice, newTeamId, newNotes } = {}) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    const inactive = rejectInactive(session);
    if (inactive) return inactive;

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
    if (newNotes !== undefined) {
        entry.notes = String(newNotes);
    }

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
            notes: entry.notes || '',
            timestamp: entry.timestamp,
            nominationOrder: entry.nominationOrder
        })),
        playerNotes: toPlainObject(plain.playerNotes)
    };
}

async function getDraftSnapshot(draftSessionId) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }
    return { success: true, session, snapshot: buildSnapshot(session) };
}

async function setPlayerNote(draftSessionId, playerId, note) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }
    session.playerNotes.set(String(playerId), String(note || ''));
    session.markModified('playerNotes');
    await session.save();
    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-18.2 / US-18.3: Move a purchased player to a different position slot on the same team.
 * Validates eligibility and slot availability. Atomically decrements the old slot
 * and increments the new one.
 */
async function movePosition(draftSessionId, purchaseId, { positionFilled: targetPos, eligiblePositions = [] }) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) return { success: false, errorMessage: 'Draft session not found.' };

    const entry = session.draftHistory.find((h) => h.purchaseId === purchaseId);
    if (!entry) return { success: false, errorMessage: 'Purchase not found.' };

    const team = session.teams.find((t) => t.teamId === entry.teamId);
    if (!team) return { success: false, errorMessage: 'Team not found.' };

    const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots || {});
    const filledSlots = toPlainObject(team.filledRosterSlots);

    // US-18.3: enforce position eligibility
    const ALWAYS_ELIGIBLE = new Set(['UTIL', 'BENCH']);
    const isBatter = eligiblePositions.length > 0 && eligiblePositions.every((p) => !PITCHER_POSITIONS.has(p));

    if (!ALWAYS_ELIGIBLE.has(targetPos)) {
        const isDirectMatch   = eligiblePositions.includes(targetPos);
        const isUtilForBatter = targetPos === 'UTIL' && isBatter;
        if (!isDirectMatch && !isUtilForBatter) {
            return { success: false, errorMessage: `Player is not eligible at ${targetPos}.`, code: 'POSITION_INELIGIBLE' };
        }
    }

    // Target slot must exist in the league's roster config
    if (rosterSlots[targetPos] == null) {
        return { success: false, errorMessage: `Position ${targetPos} is not in the roster configuration.`, code: 'POSITION_INELIGIBLE' };
    }

    const currentPos = entry.positionFilled;

    // Target slot must have an opening (unless moving to the same slot)
    if (targetPos !== currentPos) {
        const targetFilled = Number(filledSlots[targetPos] || 0);
        const targetCapacity = Number(rosterSlots[targetPos] || 0);
        if (targetFilled >= targetCapacity) {
            return { success: false, errorMessage: `No open ${targetPos} slots remaining.`, code: 'ROSTER_FULL' };
        }

        // Atomically update filled counts
        if (currentPos && rosterSlots[currentPos] != null) {
            const cur = Number(filledSlots[currentPos] || 0);
            team.filledRosterSlots.set(currentPos, Math.max(0, cur - 1));
        }
        team.filledRosterSlots.set(targetPos, targetFilled + 1);
        entry.positionFilled = targetPos;

        team.markModified?.('filledRosterSlots');
        session.markModified('teams');
        await session.save();
    }

    return { success: true, session, snapshot: buildSnapshot(session) };
}

/**
 * US-19.3: Move a minor league player from one team to another.
 * Validates destination team has a free minor league slot.
 */
async function moveMinor(draftSessionId, playerId, { teamId: destTeamId }) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) return { success: false, errorMessage: 'Draft session not found.' };

    const playerIdStr = String(playerId);
    const maxSlots = Number(session.leagueSettings?.minorLeagueSlots ?? 6);

    // Find source team
    let sourceTeam = null;
    let minorEntry = null;
    for (const t of session.teams) {
        const entry = (t.minorLeaguePlayers || []).find((m) => m.playerId === playerIdStr);
        if (entry) { sourceTeam = t; minorEntry = entry; break; }
    }
    if (!sourceTeam) return { success: false, errorMessage: 'Player not found on any minor league roster.' };
    if (sourceTeam.teamId === destTeamId) return { success: true, session, snapshot: buildSnapshot(session) };

    const destTeam = session.teams.find((t) => t.teamId === destTeamId);
    if (!destTeam) return { success: false, errorMessage: 'Destination team not found.' };

    if ((destTeam.minorLeaguePlayers || []).length >= maxSlots) {
        return { success: false, errorMessage: `${destTeam.teamName}'s minor league roster is full (${maxSlots} slots).` };
    }

    sourceTeam.minorLeaguePlayers = (sourceTeam.minorLeaguePlayers || []).filter((m) => m.playerId !== playerIdStr);
    if (!destTeam.minorLeaguePlayers) destTeam.minorLeaguePlayers = [];
    destTeam.minorLeaguePlayers.push(minorEntry);

    session.markModified('teams');
    await session.save();
    return { success: true, session, snapshot: buildSnapshot(session) };
}

module.exports = {
    initializeDraft,
    recordPurchase,
    undoPurchase,
    editPurchase,
    getDraftSnapshot,
    setPlayerNote,
    movePosition,
    moveMinor,
    buildSnapshot,
};
