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
        draftSessionId: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('League', LeagueSchema);
