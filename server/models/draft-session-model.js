const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

function generatePurchaseId() {
    if (typeof crypto.randomUUID === 'function') {
        return `purchase-${crypto.randomUUID()}`;
    }
    return `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// DraftPurchase (US-2.3): ordered history entry for a single auction purchase.
const DraftPurchaseSchema = new Schema(
    {
        purchaseId: {
            type: String,
            required: true,
            default: generatePurchaseId,
            trim: true
        },
        playerId: {
            type: String,
            required: true,
            trim: true
        },
        playerName: {
            type: String,
            required: true,
            trim: true
        },
        teamId: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 1
        },
        positionFilled: {
            type: String,
            default: null,
            trim: true
        },
        notes: {
            type: String,
            default: ''
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        nominationOrder: {
            type: Number,
            required: true
        },
        // US-18.1: marks keeper-converted entries
        isKeeper: { type: Boolean, default: false },
        contractYears: { type: Number, default: null },
    },
    { _id: false }
);

// Embedded record of a player a team owns after a purchase (US-2.2).
const TeamPurchasedPlayerSchema = new Schema(
    {
        playerId: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 1
        }
    },
    { _id: false }
);

// US-18.1: keeper entry stored pre-draft; converted to purchasedPlayer on start
const KeeperSchema = new Schema(
    {
        playerId:         { type: String, required: true, trim: true },
        playerName:       { type: String, required: true, trim: true },
        price:            { type: Number, required: true, min: 1 },
        contractYears:    { type: Number, default: 1, min: 0 },
        positionAssigned: { type: String, default: null, trim: true },
    },
    { _id: false }
);

// FantasyTeam (US-2.2): embedded within DraftSession.teams[].
const TeamSchema = new Schema(
    {
        teamId: {
            type: String,
            required: true,
            trim: true
        },
        teamName: {
            type: String,
            required: true,
            trim: true
        },
        budgetRemaining: {
            type: Number,
            default: 0
        },
        purchasedPlayers: {
            type: [TeamPurchasedPlayerSchema],
            default: []
        },
        filledRosterSlots: {
            type: Map,
            of: Number,
            default: {}
        },
        // US-18.1: keepers — pre-draft, converted to purchases on draft start
        keepers: {
            type: [KeeperSchema],
            default: []
        },
    },
    { _id: false }
);

// DraftSession (US-2.1): top-level auction draft state document.
// Status transitions: setup -> active -> (paused?) -> completed.
// `nominationOrder` is a monotonic counter on the session so history entries
// keep stable ordering even when purchases are undone.
const DraftSessionSchema = new Schema(
    {
        draftSessionId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            default: '',
            trim: true
        },
        leagueId: {
            type: Schema.Types.ObjectId,
            ref: 'League',
            required: true,
            index: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: ['setup', 'active', 'paused', 'completed'],
            default: 'setup'
        },
        myTeamId: {
            type: String,
            default: null,
            trim: true
        },
        nominationOrder: {
            type: Number,
            default: 0
        },
        pooledAt: {
            type: Date,
            default: null
        },
        leagueSettings: {
            numberOfTeams: {
                type: Number,
                default: 12
            },
            salaryCap: {
                type: Number,
                default: 260
            },
            rosterSlots: {
                type: Map,
                of: Number,
                default: {}
            },
            scoringType: {
                type: String,
                default: '5x5 Roto'
            },
            draftType: {
                type: String,
                default: 'AUCTION'
            },
            // US-15.1: season year tag so multi-year history stays organised
            seasonYear: {
                type: Number,
                default: () => new Date().getFullYear()
            },
            // US-17.1: AL-only / NL-only / all-MLB player pool scope
            leagueScope: {
                type: String,
                enum: ['MLB', 'AL', 'NL'],
                default: 'MLB'
            },
            // US-17.2: custom scoring stat categories (overrides scoringType preset)
            statCategories: {
                hitting:  { type: [String], default: undefined },
                pitching: { type: [String], default: undefined }
            },
            // US-17.3: which positions count as hitter vs pitcher slots
            positionCatalog: {
                hitter:  { type: [String], default: undefined },
                pitcher: { type: [String], default: undefined }
            }
        },
        teams: {
            type: [TeamSchema],
            default: []
        },
        availablePlayerIds: {
            type: [String],
            default: []
        },
        purchasedPlayerIds: {
            type: [String],
            default: []
        },
        draftHistory: {
            type: [DraftPurchaseSchema],
            default: []
        },
        playerNotes: {
            type: Map,
            of: String,
            default: {}
        }
    },
    { timestamps: true }
);

const DraftSession = mongoose.model('DraftSession', DraftSessionSchema);
DraftSession.generatePurchaseId = generatePurchaseId;

module.exports = DraftSession;
