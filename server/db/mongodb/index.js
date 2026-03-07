const DatabaseManager = require("../DatabaseManager");
const mongoose = require("mongoose");
const User = require("../../models/user-model.js");
const League = require("../../models/league-model.js");
const Player = require("../../models/player-model.js");

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
        members: [],
        seasonYear: data.seasonYear ? Number(data.seasonYear) : null,
        numberOfTeams: data.numberOfTeams ? Number(data.numberOfTeams) : 12,
        draftType: data.draftType || "Auction Draft",
        leagueMode: data.leagueMode || "Join Draft",
        currentTeams: 0,
        isActive: true
    });

    return await league.save();
}

    async getLeaguesForUser(userId) {
        return await League.find({
            $or: [
                { commissioner: userId },
                { members: userId }
            ]
        }).sort({ createdAt: -1 });
    }

    async joinLeagueByInviteCode(userId, inviteCode) {
        const code = String(inviteCode || "").trim().toUpperCase();
        const league = await League.findOne({ inviteCode: code });

        if (!league) {
            return { ok: false, status: 404, errorMessage: "Invalid invite code." };
        }

        if (String(league.commissioner) === String(userId)) {
            return { ok: true, league };
        }

        if (!Array.isArray(league.members)) {
            league.members = [];
        }

        const alreadyMember = league.members.some((memberId) => String(memberId) === String(userId));
        if (alreadyMember) {
            return { ok: true, league };
        }

        const maxTeams = Number(league.numberOfTeams || 0);
        const currentTeams = Number(league.currentTeams || 0);
        if (maxTeams > 0 && currentTeams >= maxTeams) {
            return { ok: false, status: 400, errorMessage: "League is full." };
        }

        league.members.push(userId);
        league.currentTeams = currentTeams + 1;
        await league.save();

        return { ok: true, league };
    }

    _generateInviteCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
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
}

module.exports = MongoDBManager;
