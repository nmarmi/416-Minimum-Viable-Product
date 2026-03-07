const auth = require('../auth');
const db = require('../db');

const getPlayers = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        const search = req.query.search || '';
        const team = req.query.team || '';
        const position = req.query.position || '';
        const source = req.query.source || 'projection';
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 1000);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const { list, total } = await db.getPlayers({
            search,
            team,
            position,
            source,
            limit,
            offset
        });

        return res.status(200).json({
            success: true,
            players: list,
            total
        });
    } catch (err) {
        console.error("getPlayers error:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Unable to load players."
        });
    }
};

module.exports = {
    getPlayers
};
