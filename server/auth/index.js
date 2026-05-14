const jwt = require("jsonwebtoken");

function authManager() {
    const getJwtSecret = () => {
        if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
        if (process.env.NODE_ENV !== "production") return "local-dev-jwt-secret";
        throw new Error("Missing JWT_SECRET environment variable.");
    };

    // Express middleware — verifies the JWT cookie and sets req.userId
    const verify = (req, res, next) => {
        try {
            const token = req.cookies.token;
            if (!token) {
                return res.status(401).json({ loggedIn: false, user: null, errorMessage: "Unauthorized" });
            }
            const verified = jwt.verify(token, getJwtSecret());
            req.userId = verified.userId;
            next();
        } catch (_) {
            return res.status(401).json({ loggedIn: false, user: null, errorMessage: "Unauthorized" });
        }
    };

    // Inline helper — returns userId from cookie or null (no response sent)
    const verifyUser = (req) => {
        try {
            const token = req.cookies.token;
            if (!token) return null;
            return jwt.verify(token, getJwtSecret()).userId;
        } catch (_) {
            return null;
        }
    };

    const signToken = (userId) => jwt.sign({ userId }, getJwtSecret());

    return { verify, verifyUser, signToken };
}

const auth = authManager();
module.exports = auth;
