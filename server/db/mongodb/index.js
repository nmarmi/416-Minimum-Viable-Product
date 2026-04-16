const DatabaseManager = require("../DatabaseManager");
const mongoose = require("mongoose");
const User = require("../../models/user-model.js");
const League = require("../../models/league-model.js");
const Player = require("../../models/player-model.js");
const DraftSession = require("../../models/draft-session-model.js");

class MongoDBManager extends DatabaseManager {
    async init() {
        mongoose.set("bufferCommands", false);

        const mongoUri = process.env.MONGODB_CONNECT;
        if (!mongoUri) {
            throw new Error("Missing MONGODB_CONNECT environment variable.");
        }

        try {
            await mongoose.connect(mongoUri, {
                //useNewUrlParser: true,
                serverSelectionTimeoutMS: 5000
            });
            console.log("MongoDB Connected");
        } catch (e) {
            console.error("MongoDB Connection error", e.message);
            throw e;
        }
    }
    
    
    // user
    async getUserByEmail(email) {
        return await User.findOne({email});
    }

    async getUserById(id) {
        return await User.findById(id);
    }

    async createUser(data) {
        const newUser = new User(data);
        return await newUser.save();
    }

    async updateUser(userId, data) {
        const updateFields = {};
        if (data.userName) updateFields.userName = data.userName;
        if (data.avatar) updateFields.avatar = data.avatar;
        return await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true }
        );
    }

    async deleteUser(userId) {
        return await User.findByIdAndDelete(userId.toString());
    }

    // league
    async createLeague(ownerId, data) {
        const league = new League({
            name: data.name,
            owner: ownerId
        });

        return await league.save();
    }

    async getLeaguesForUser(userId) {
        return await League.find({
            $or: [
                { owner: userId },
            ]
        }).sort({ createdAt: -1 });
    }

    async getLeagueById(leagueId) {
        return await League.findById(leagueId);
    }

    async setLeagueDraftSession(leagueId, draftSessionId) {
        return await League.findByIdAndUpdate(leagueId, { draftSessionId }, { new: true });
    }

    async deleteLeagueById(leagueId) {
        return await League.findByIdAndDelete(leagueId);
    }

    // draft session
    async createDraftSession(sessionData) {
        const session = new DraftSession(sessionData);
        return await session.save();
    }

    async getDraftSessionById(draftSessionId) {
        return await DraftSession.findOne({ draftSessionId }).lean();
    }

    async saveDraftSession(draftSession) {
        return await draftSession.save();
    }

    async deleteDraftSessionBySessionId(draftSessionId) {
        return await DraftSession.deleteOne({ draftSessionId });
    }

    // players (projections / stats)
    async getPlayers(options = {}) {
        const { search = '', team = '', position = '', source = 'projection', limit = 500, offset = 0 } = options;
        const query = { source };
        if (search && search.trim()) {
            query.playerName = { $regex: search.trim(), $options: 'i' };
        }
        if (team && team.trim()) {
            query.team = { $regex: team.trim(), $options: 'i' };
        }
        if (position && position.trim()) {
            query.position = { $regex: position.trim(), $options: 'i' };
        }
        const list = await Player.find(query).sort({ fpts: -1 }).skip(offset).limit(limit).lean();
        const total = await Player.countDocuments(query);
        return { list, total };
    }

    async getAvailablePlayerIds(options = {}) {
        const { source = 'projection' } = options;
        const players = await Player.find({ source }).select('playerId _id').lean();
        return players.map((player) => player.playerId || String(player._id));
    }
}

module.exports = MongoDBManager;
