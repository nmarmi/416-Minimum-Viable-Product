class DatabaseManager {
    async init() {}

    // user
    async getUserByEmail(email){}
    async getUserById(userId){}
    async createUser(userData){}
    async deleteUser(userId){}

    // league
    async createLeague(commissionerId, leagueData){}
    async getLeaguesForUser(userId){}
    async joinLeagueByInviteCode(userId, inviteCode){}
}

module.exports = DatabaseManager;
