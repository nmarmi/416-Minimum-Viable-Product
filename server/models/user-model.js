const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const UserSchema = new Schema(
    {
        email:        { type: String, required: true, unique: true },
        userName:     { type: String, required: true },
        passwordHash: { type: String, required: true },
        avatar:       { type: String, default: 'default-avatar' },
        // US-16.2: password reset token (stored as SHA-256 hash; never the raw value)
        resetTokenHash:      { type: String, default: null },
        resetTokenExpiresAt: { type: Date,   default: null },
    },
    { timestamps: true },
);

module.exports = mongoose.model('User', UserSchema);
