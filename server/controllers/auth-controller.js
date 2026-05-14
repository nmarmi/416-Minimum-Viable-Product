const crypto = require('crypto');
const auth   = require('../auth');
const db     = require('../db');
const bcrypt = require('bcryptjs');
const User   = require('../models/user-model');

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const getCookieOptions = (overrides = {}) => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure:   isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        ...overrides,
    };
};

const getLoggedIn = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) {
            return res.status(200).json({ loggedIn: false, user: null, errorMessage: '?' });
        }
        const user = await db.getUserById(userId);
        return res.status(200).json({
            loggedIn: true,
            user: { _id: user._id, userName: user.userName, email: user.email, avatar: user.avatar },
        });
    } catch (err) {
        console.error('[auth] getLoggedIn error:', err.message);
        return res.json(false);
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ errorMessage: 'Please enter all required fields.' });
        }

        const existingUser = await db.getUserByEmail(email);
        if (!existingUser) {
            return res.status(401).json({ errorMessage: 'Wrong email or password provided.' });
        }

        const passwordCorrect = await bcrypt.compare(password, existingUser.passwordHash);
        if (!passwordCorrect) {
            return res.status(401).json({ errorMessage: 'Wrong email or password provided.' });
        }

        const token = auth.signToken(existingUser._id);
        return res.cookie('token', token, getCookieOptions()).status(200).json({
            success: true,
            user: { _id: existingUser._id, userName: existingUser.userName, email: existingUser.email, avatar: existingUser.avatar },
        });
    } catch (err) {
        console.error('[auth] loginUser error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to login right now.' });
    }
};

const logoutUser = (req, res) => {
    res.cookie('token', '', getCookieOptions({ expires: new Date(0) })).send();
};

const updateUser = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { userName, avatar } = req.body;
        const updatedUser = await db.updateUser(userId, { userName, avatar });
        if (!updatedUser) return res.status(400).json({ success: false, errorMessage: 'Error updating user.' });

        return res.status(200).json({
            success: true,
            user: { _id: updatedUser._id, userName: updatedUser.userName, email: updatedUser.email, avatar: updatedUser.avatar },
        });
    } catch (err) {
        console.error('[auth] updateUser error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Error updating user.' });
    }
};

const registerUser = async (req, res) => {
    try {
        const { userName, email, password, passwordVerify, avatar } = req.body;

        if (!userName || !email || !password || !passwordVerify) {
            return res.status(400).json({ errorMessage: 'Please enter all required fields.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ errorMessage: 'Please enter a password of at least 8 characters.' });
        }
        if (password !== passwordVerify) {
            return res.status(400).json({ errorMessage: 'Please enter the same password twice.' });
        }

        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, errorMessage: 'An account with this email address already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const savedUser = await db.createUser({
            userName,
            email,
            passwordHash,
            avatar: avatar && avatar !== '' ? avatar : 'default-avatar',
        });

        const token = auth.signToken(savedUser._id);
        return res.cookie('token', token, getCookieOptions()).status(200).json({
            success: true,
            user: { _id: savedUser._id, userName: savedUser.userName, email: savedUser.email, avatar: savedUser.avatar },
        });
    } catch (err) {
        console.error('[auth] registerUser error:', err.message);
        if (err?.code === 11000) {
            return res.status(400).json({ success: false, errorMessage: 'An account with this email address already exists.' });
        }
        return res.status(500).json({ success: false, errorMessage: 'Unable to create account right now.' });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });

        const { currentPassword, newPassword, newPasswordVerify } = req.body;
        if (!currentPassword || !newPassword || !newPasswordVerify) {
            return res.status(400).json({ errorMessage: 'Please fill in all fields.' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ errorMessage: 'New password must be at least 8 characters.' });
        }
        if (newPassword !== newPasswordVerify) {
            return res.status(400).json({ errorMessage: 'New passwords do not match.' });
        }

        const user = await db.getUserById(userId);
        const passwordCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!passwordCorrect) {
            return res.status(401).json({ errorMessage: 'Current password is incorrect.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.updateUser(userId, { passwordHash });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('[auth] changePassword error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Error changing password.' });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = auth.verifyUser(req);
        if (!userId) return res.status(401).json({ success: false, errorMessage: 'Unauthorized' });
        await db.deleteUser(userId);
        return res.cookie('token', '', getCookieOptions({ expires: new Date(0) })).status(200).json({ success: true });
    } catch (err) {
        console.error('[auth] deleteAccount error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Error deleting account.' });
    }
};

// US-16.2: forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    if (!email) {
        return res.status(400).json({ success: false, errorMessage: 'Email is required.', code: 'MISSING_EMAIL' });
    }
    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
        }

        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        user.resetTokenHash      = tokenHash;
        user.resetTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);
        await user.save();

        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
            // TODO: integrate an email provider (SendGrid, Resend, etc.)
            return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
        }
        return res.status(200).json({
            success: true,
            message:   'Dev mode: reset token returned directly (no email sent).',
            token:     rawToken,
            expiresAt: user.resetTokenExpiresAt,
        });
    } catch (err) {
        console.error('[auth] forgotPassword error:', err.message);
        return res.status(500).json({ success: false, errorMessage: 'Unable to process request.' });
    }
};

// US-16.2: reset-password
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
        const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() } });
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
};
