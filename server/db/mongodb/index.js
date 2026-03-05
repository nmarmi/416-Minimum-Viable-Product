const DatabaseManager = require("../DatabaseManager");
const mongoose = require("mongoose");

class MongoDBManager extends DatabaseManager {
    async init() {
        await mongoose
            .connect(process.env.MONGODB_CONNECT, { useNewUrlParser: true })
            .catch(e => {
                console.error('MongoDB Connection error', e.message)
            })
        console.log("MongoDB Connected")
    }


}

module.exports = MongoDBManager;
