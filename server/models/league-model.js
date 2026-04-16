const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeagueSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
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
    },
    { timestamps: true }
);

module.exports = mongoose.model('League', LeagueSchema);
