const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Player projection/stat record from CSV imports.
 * "Player" column format: "Name Pos | TEAM" (e.g. "Juan Soto OF | NYM").
 * source: 'projection' | '2025' | '3year' for which CSV the row came from.
 */
const PlayerSchema = new Schema(
    {
        playerName: { type: String, required: true, trim: true },
        team: { type: String, required: true, trim: true },
        position: { type: String, required: true, trim: true },
        source: { type: String, default: 'projection', enum: ['projection', '2025', '3year'] },
        // batting (and shared) stats from CSV
        ab: { type: Number, default: null },
        r: { type: Number, default: null },
        h: { type: Number, default: null },
        single: { type: Number, default: null },
        double: { type: Number, default: null },
        triple: { type: Number, default: null },
        hr: { type: Number, default: null },
        rbi: { type: Number, default: null },
        bb: { type: Number, default: null },
        k: { type: Number, default: null },
        sb: { type: Number, default: null },
        cs: { type: Number, default: null },
        avg: { type: Number, default: null },
        obp: { type: Number, default: null },
        slg: { type: Number, default: null },
        fpts: { type: Number, default: null },
        status: { type: String, default: 'active', enum: ['active', 'injured', 'minors'] },
        isAvailable: { type: Boolean, default: true }
    },
    { timestamps: true }
);

PlayerSchema.index({ source: 1 });
PlayerSchema.index({ playerName: 1, team: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('Player', PlayerSchema);
