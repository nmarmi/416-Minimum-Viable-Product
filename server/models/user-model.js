const mongoose = require('mongoose')
const Schema = mongoose.Schema

const UserSchema = new Schema(
    {
        email: { type: String, required: true, unique: true },
        userName: { type: String, required: true },
        passwordHash: { type: String, required: true },
        avatar: { type: String, default: "default-avatar" }
    },
    { timestamps: true },
)

module.exports = mongoose.model('User', UserSchema)
