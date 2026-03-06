const DatabaseManager = require("../DatabaseManager");
const mongoose = require("mongoose");
const User = require("../../models/user-model.js");
const League = require("../../models/league-model.js");

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
    async createLeague(commissionerId, data) {
    const inviteCode = data.inviteCode || this._generateInviteCode();

    const league = new League({
        name: data.name,
        inviteCode,
        commissioner: commissionerId,
        seasonYear: data.seasonYear ? Number(data.seasonYear) : null,
        numberOfTeams: data.numberOfTeams ? Number(data.numberOfTeams) : 12,
        draftType: data.draftType || "Auction Draft",
        leagueMode: data.leagueMode || "Join Draft",
        currentTeams: 0,
        isActive: true
    });

    return await league.save();
}

    async getLeaguesForCommissioner(commissionerId) {
        return await League.find({ commissioner: commissionerId }).sort({ createdAt: -1 });
    }

    _generateInviteCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

module.exports = MongoDBManager;
