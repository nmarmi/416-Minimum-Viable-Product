const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DraftPurchaseSchema = new Schema(
    {
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
        timestamp: {
            type: Date,
            default: Date.now
        },
        nominationOrder: {
            type: Number,
            required: true
        }
    },
);

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
            type: [String],
            default: []
        },
        filledRosterSlots: {
            type: Map,
            of: Number,
            default: {}
        }
    },
    { _id: false }
);

const DraftSessionSchema = new Schema(
    {
        draftSessionId: {
            type: String,
            required: true,
            unique: true,
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
            required: true
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
        draftHistory: {
            type: [DraftPurchaseSchema],
            default: []
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('DraftSession', DraftSessionSchema);
