class DatabaseManager {
    async init() {}

    // user
    async getUserByEmail(email){}
    async getUserById(userId){}
    async createUser(userData){}
    async deleteUser(userId){}
}

module.exports = DatabaseManager;