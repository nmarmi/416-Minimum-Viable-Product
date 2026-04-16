class DatabaseManager {
    async init() {}

    // user
    async getUserByEmail(email){}
    async getUserById(userId){}
    async createUser(userData){}
    async deleteUser(userId){}

    // league
    async createLeague(ownerId, leagueData){}
    async getLeaguesForUser(userId){}
    async getLeagueById(leagueId){}

    // draft session
    async createDraftSession(sessionData){}
    async getDraftSessionById(draftSessionId){}
    async saveDraftSession(draftSession){}

    // players
    async getPlayers(options = {}){}
    async getAvailablePlayerIds(options = {}){}
}

module.exports = DatabaseManager;
