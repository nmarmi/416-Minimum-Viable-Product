const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeagueSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        inviteCode: {
            type: String,
            required: true,
            unique: true
        },
        commissioner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        seasonYear: {
            type: Number,
            default: null
        },
        numberOfTeams: {
            type: Number,
            default: 12
        },
        draftType: {
            type: String,
            default: 'Auction Draft'
        },
        leagueMode: {
            type: String,
            default: 'Join Draft'
        },
        currentTeams: {
            type: Number,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('League', LeagueSchema);