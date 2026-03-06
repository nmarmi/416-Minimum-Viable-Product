const jwt = require("jsonwebtoken")

function authManager() {
    const getJwtSecret = () => {
        if (process.env.JWT_SECRET) {
            return process.env.JWT_SECRET;
        }

        if (process.env.NODE_ENV !== "production") {
            return "local-dev-jwt-secret";
        }

        throw new Error("Missing JWT_SECRET environment variable.");
    };

    const verify = (req, res, next) => {
        console.log("req: " + req);
        console.log("next: " + next);
        console.log("Who called verify?");
        try {
            const token = req.cookies.token;
            if (!token) {
                return res.status(401).json({
                    loggedIn: false,
                    user: null,
                    errorMessage: "Unauthorized"
                })
            }

            const verified = jwt.verify(token, getJwtSecret())
            console.log("verified.userId: " + verified.userId);
            req.userId = verified.userId;

            next();
        } catch (err) {
            console.error(err);
            return res.status(401).json({
                loggedIn: false,
                user: null,
                errorMessage: "Unauthorized"
            });
        }
    }

    const verifyUser = (req) => {
        try {
            const token = req.cookies.token;
            if (!token) {
                return null;
            }

            const decodedToken = jwt.verify(token, getJwtSecret());
            return decodedToken.userId;
        } catch (err) {
            return null;
        }
    }

    const signToken = (userId) => {
        return jwt.sign({
            userId: userId
        }, getJwtSecret());
    }

    return {
        verify,
        verifyUser,
        signToken
    };
}

const auth = authManager();
module.exports = auth;
