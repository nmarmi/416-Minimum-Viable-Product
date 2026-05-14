const crypto = require('crypto');
const auth   = require('../auth');
const db     = require('../db');
const bcrypt = require('bcryptjs');
const User   = require('../models/user-model');

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getCookieOptions = (overrides = {}) => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        ...overrides
    };
};

const getLoggedIn = async (req, res) => {
    try {
        let userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(200).json({
                loggedIn: false,
                user: null,
                errorMessage: "?"
            })
        }

        const loggedInUser = await db.getUserById(userId)
        console.log("loggedInUser: " + loggedInUser);

        return res.status(200).json({
            loggedIn: true,
            user: {
                _id: loggedInUser._id,
                userName: loggedInUser.userName,
                email: loggedInUser.email,
                avatar: loggedInUser.avatar
            }
        })
    } catch (err) {
        console.log("err: " + err);
        res.json(false);
    }
}

const loginUser = async (req, res) => {
    console.log("loginUser");
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ errorMessage: "Please enter all required fields." });
        }

        const existingUser = await db.getUserByEmail(email)
        console.log("existingUser: " + existingUser);
        if (!existingUser) {
            return res
                .status(401)
                .json({
                    errorMessage: "Wrong email or password provided."
                })
        }

        console.log("provided password: " + password);
        const passwordCorrect = await bcrypt.compare(password, existingUser.passwordHash);
        if (!passwordCorrect) {
            console.log("Incorrect password");
            return res
                .status(401)
                .json({
                    errorMessage: "Wrong email or password provided."
                })
        }

        // LOGIN THE USER
        const token = auth.signToken(existingUser._id);
        console.log(token);

        res.cookie("token", token, getCookieOptions()).status(200).json({
            success: true,
            user: {
                _id: existingUser._id,
                userName: existingUser.userName,
                email: existingUser.email,
                avatar: existingUser.avatar
            }
        })

    } catch (err) {
        console.error("loginUser error:", err);
        res.status(500).json({
            success: false,
            errorMessage: "Unable to login right now. Check server config and database connection."
        });
    }
}

const logoutUser = async (req, res) => {
    res.cookie("token", "", getCookieOptions({
        expires: new Date(0)
    })).send();
}

const updateUser = async (req, res) => {
    try {
        let userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                errorMessage: "Unauthorized"
            });
        }

        let { userName, avatar } = req.body;
        let updatedUser = await db.updateUser(userId, { userName, avatar });
        if (!updatedUser) {
            return res.status(400).json({
                success: false,
                errorMessage: "error updating user"
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                _id: updatedUser._id,
                userName: updatedUser.userName,
                email: updatedUser.email,
                avatar: updatedUser.avatar
            }
        });
    } catch (err) {
        console.error("Error updating user:", err);
        return res.status(500).json({
            success: false,
            errorMessage: "Error updating user"
        });
    }
}

const registerUser = async (req, res) => {
    console.log("REGISTERING USER IN BACKEND");
    try {
        const { userName, email, password, passwordVerify, avatar } = req.body;
        console.log("create user: " + userName + " " + email + " " + password + " " + passwordVerify+ " "+avatar);
        if (!userName || !email || !password || !passwordVerify) {
            return res
                .status(400)
                .json({ errorMessage: "Please enter all required fields." });
        }
        console.log("all fields provided");
        if (password.length < 8) {
            return res
                .status(400)
                .json({
                    errorMessage: "Please enter a password of at least 8 characters."
                });
        }
        console.log("password long enough");
        if (password !== passwordVerify) {
            return res
                .status(400)
                .json({
                    errorMessage: "Please enter the same password twice."
                })
        }
        console.log("password and password verify match");
        const existingUser = await db.getUserByEmail(email)
        console.log("existingUser: " + existingUser);
        if (existingUser) {
            return res
                .status(400)
                .json({
                    success: false,
                    errorMessage: "An account with this email address already exists."
                })
        }

        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const passwordHash = await bcrypt.hash(password, salt);
        console.log("passwordHash: " + passwordHash);

        const savedUser = await db.createUser({
            userName,
            email,
            passwordHash,
            avatar: avatar && avatar !== "" ? avatar : "default-avatar"
        });
        console.log("new user saved: " + savedUser._id);

        // LOGIN THE USER
        const token = auth.signToken(savedUser._id);
        console.log("token:" + token);

        await res.cookie("token", token, getCookieOptions()).status(200).json({
            success: true,
            user: {
                _id: savedUser._id,
                userName: savedUser.userName,
                email: savedUser.email,
                avatar: savedUser.avatar
            }
        })

        console.log("token sent");

    } catch (err) {
        console.error("registerUser error:", err);

        if (err && err.code === 11000) {
            return res.status(400).json({
                success: false,
                errorMessage: "An account with this email address already exists."
            });
        }

        return res.status(500).json({
            success: false,
            errorMessage: "Unable to create account right now. Check server config and database connection."
        });
    }
}

changePassword = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: "Unauthorized" });
        }

        const { currentPassword, newPassword, newPasswordVerify } = req.body;
        if (!currentPassword || !newPassword || !newPasswordVerify) {
            return res.status(400).json({ errorMessage: "Please fill in all fields." });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ errorMessage: "New password must be at least 8 characters." });
        }
        if (newPassword !== newPasswordVerify) {
            return res.status(400).json({ errorMessage: "New passwords do not match." });
        }

        const user = await db.getUserById(userId);
        const passwordCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordCorrect) {
            return res.status(401).json({ errorMessage: "Current password is incorrect." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);
        await db.updateUser(userId, { passwordHash });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("changePassword error:", err);
        return res.status(500).json({ success: false, errorMessage: "Error changing password." });
    }
}

deleteAccount = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(401).json({ success: false, errorMessage: "Unauthorized" });
        }

        await db.deleteUser(userId);

        res.cookie("token", "", getCookieOptions({ expires: new Date(0) })).status(200).json({ success: true });
    } catch (err) {
        console.error("deleteAccount error:", err);
        return res.status(500).json({ success: false, errorMessage: "Error deleting account." });
    }
}

// US-16.2: forgot-password — issue a single-use, time-limited reset token
const forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ success: false, errorMessage: 'Email is required.', code: 'MISSING_EMAIL' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Always respond 200 so callers can't enumerate registered emails
        if (!user) {
            return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
        }

        // Generate a 32-byte random token; store only its SHA-256 hash
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.resetTokenHash      = tokenHash;
        user.resetTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);
        await user.save();

        // In production, email the token. In development, return it directly so
        // tests and manual flows work without an email service.
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
            // TODO: integrate an email provider (SendGrid, Resend, etc.)
            console.info('[auth] password reset token generated for', email, '— email delivery not yet wired up');
            return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
        }

        // Dev mode: return the raw token so it can be used immediately in tests
        return res.status(200).json({
            success: true,
            message:  'Dev mode: reset token returned directly (no email sent).',
            token:    rawToken,
            expiresAt: user.resetTokenExpiresAt,
        });
    } catch (err) {
        console.error('[auth] forgotPassword error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to process request.' });
    }
};

// US-16.2: reset-password — validate token and set new password
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
        return res.status(400).json({ success: false, errorMessage: 'Token and newPassword are required.', code: 'MISSING_FIELDS' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, errorMessage: 'Password must be at least 8 characters.', code: 'WEAK_PASSWORD' });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetTokenHash:      tokenHash,
            resetTokenExpiresAt: { $gt: new Date() },
        });

        if (!user) {
            return res.status(400).json({ success: false, errorMessage: 'Reset token is invalid or has expired.', code: 'TOKEN_EXPIRED' });
        }

        user.passwordHash        = await bcrypt.hash(newPassword, 10);
        user.resetTokenHash      = null;
        user.resetTokenExpiresAt = null;
        await user.save();

        return res.status(200).json({ success: true, message: 'Password updated. You can now log in with your new password.' });
    } catch (err) {
        console.error('[auth] resetPassword error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to reset password.' });
    }
};

module.exports = {
    getLoggedIn,
    registerUser,
    loginUser,
    logoutUser,
    updateUser,
    changePassword,
    deleteAccount,
    forgotPassword,
    resetPassword,
}
