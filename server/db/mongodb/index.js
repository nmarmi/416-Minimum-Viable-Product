const DatabaseManager = require("../DatabaseManager");
const mongoose = require("mongoose");
const User = require("../../models/user-model.js");

class MongoDBManager extends DatabaseManager {
    async init() {
        await mongoose
            .connect(process.env.MONGODB_CONNECT, { useNewUrlParser: true })
            .catch(e => {
                console.error('MongoDB Connection error', e.message)
                return;
            })
        console.log("MongoDB Connected")
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

}

module.exports = MongoDBManager;
