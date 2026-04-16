const mongoose = require('mongoose');
const DraftSession = require('../models/draft-session-model');
const Player = require('../models/player-model');

const PITCHER_POSITIONS = new Set(['SP', 'RP', 'P']);

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

/**
 * Records a draft purchase against a session.
 *
 * @param {string} draftSessionId
 * @param {{ playerId: string, playerName?: string, teamId: string, price: number }} purchase
 * @returns {{ success: boolean, session?: object, errorMessage?: string }}
 */
async function recordPurchase(draftSessionId, { playerId, playerName, teamId, price }) {
    const session = await DraftSession.findOne({ draftSessionId });
    if (!session) {
        return { success: false, errorMessage: 'Draft session not found.' };
    }

    const playerIdStr = String(playerId);

    if (!session.availablePlayerIds.includes(playerIdStr)) {
        return { success: false, errorMessage: 'Player is not available.' };
    }

    const team = session.teams.find((t) => t.teamId === teamId);
    if (!team) {
        return { success: false, errorMessage: 'Team not found in this session.' };
    }

    if (price > team.budgetRemaining) {
        return { success: false, errorMessage: 'Team has insufficient budget.' };
    }

    const rosterSlots = toPlainObject(session.leagueSettings?.rosterSlots);
    const filledSlots = toPlainObject(team.filledRosterSlots);
    const totalSlots = Object.values(rosterSlots).reduce((sum, n) => sum + Number(n || 0), 0);
    const totalFilled = Object.values(filledSlots).reduce((sum, n) => sum + Number(n || 0), 0);

    if (totalFilled >= totalSlots) {
        return { success: false, errorMessage: 'Team roster is full.' };
    }

    let position = null;
    const dbPlayer = await Player.findOne({ playerId: playerIdStr }).lean()
        || (mongoose.Types.ObjectId.isValid(playerId) ? await Player.findById(playerId).lean() : null)
        || (playerName ? await Player.findOne({ playerName: playerName.trim() }).lean() : null);
    if (dbPlayer) {
        playerName = playerName || dbPlayer.playerName;
        position = dbPlayer.position;
    }
    playerName = playerName || playerIdStr;

    const slotKey = findSlotForPosition(rosterSlots, filledSlots, position);

    // All mutations applied to the in-memory document before the single save
    session.availablePlayerIds = session.availablePlayerIds.filter((id) => id !== playerIdStr);

    team.budgetRemaining -= price;
    team.purchasedPlayers.push(playerIdStr);

    if (slotKey) {
        team.filledRosterSlots.set(slotKey, (team.filledRosterSlots.get(slotKey) || 0) + 1);
    }

    session.draftHistory.push({
        playerId: playerIdStr,
        playerName,
        teamId,
        price,
        nominationOrder: session.draftHistory.length + 1,
    });

    session.markModified('teams');
    await session.save();

    return { success: true, session };
}

module.exports = { recordPurchase };
