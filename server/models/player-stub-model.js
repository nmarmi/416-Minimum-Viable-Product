const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Local working cache of normalized records from the Player Data API.
 * The Player Data API remains canonical; this collection lets draft flows
 * keep a stable, queryable copy of player metadata between upstream calls.
 */
const PlayerStubSchema = new Schema(
    {
        playerId: { type: String, required: true, trim: true, unique: true },
        name: { type: String, required: true, trim: true },
        positions: { type: [String], default: [] },
        mlbTeam: { type: String, default: null, trim: true },
        status: { type: String, default: 'active', trim: true },
        isAvailable: { type: Boolean, default: true },
        depthChartRank: { type: Number, default: null },
        depthChartPosition: { type: String, default: null, trim: true },
        source: { type: String, default: 'player-data-api', trim: true },
        dataAsOf: { type: Date, default: null },
        lastSyncedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

PlayerStubSchema.index({ name: 1 });
PlayerStubSchema.index({ mlbTeam: 1 });
PlayerStubSchema.index({ positions: 1 });
PlayerStubSchema.index({ status: 1 });

module.exports = mongoose.model('PlayerStub', PlayerStubSchema);
