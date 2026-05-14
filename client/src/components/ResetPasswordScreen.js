import { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import authRequestSender from '../auth/requests';

export default function ResetPasswordScreen() {
    const history  = useHistory();
    const location = useLocation();

    // Token may arrive via query param (from the dev-mode "Continue" button) or be typed in
    const params       = new URLSearchParams(location.search);
    const [token,       setToken]       = useState(params.get('token') || '');
    const [password,    setPassword]    = useState('');
    const [confirm,     setConfirm]     = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const [errorMsg,    setErrorMsg]    = useState('');
    const [success,     setSuccess]     = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!token.trim())    { setErrorMsg('Reset token is required.'); return; }
        if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return; }
        if (password !== confirm) { setErrorMsg('Passwords do not match.'); return; }

        setSubmitting(true);
        const res = await authRequestSender.resetPassword(token.trim(), password);
        setSubmitting(false);

        if (res.status === 200 && res.data?.success) {
            setSuccess(true);
            setTimeout(() => history.push('/login'), 2500);
        } else {
            const code = res.data?.code;
            setErrorMsg(
                code === 'TOKEN_EXPIRED'
                    ? 'This reset link has expired or already been used. Request a new one.'
                    : res.data?.errorMessage || 'Unable to reset password.'
            );
        }
    };

    if (success) {
        return (
            <main className="login-screen">
                <section className="login-card forgot-card">
                    <h1 className="login-brand">DraftIQ</h1>
                    <h2 className="login-heading forgot-heading">Password Updated</h2>
                    <p className="forgot-subtitle">Your password has been reset. Redirecting to login…</p>
                </section>
            </main>
        );
    }

    return (
        <main className="login-screen">
            <section className="login-card forgot-card">
                <h1 className="login-brand">DraftIQ</h1>
                <div className="forgot-icon-wrap">
                    <LockOutlinedIcon sx={{ fontSize: 46, color: '#232326' }} />
                </div>
                <h2 className="login-heading forgot-heading">Reset Password</h2>

                <form className="login-form forgot-form" noValidate onSubmit={handleSubmit}>
                    <label htmlFor="reset-token" className="login-label">Reset Token</label>
                    <input
                        id="reset-token"
                        type="text"
                        className="login-input"
                        placeholder="Paste token from email"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                    />

                    <label htmlFor="new-password" className="login-label">New Password</label>
                    <input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="login-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <label htmlFor="confirm-password" className="login-label">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="login-input"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />

                    {errorMsg && <p className="login-error">{errorMsg}</p>}

                    <button className="login-submit-btn" type="submit" disabled={submitting}>
                        {submitting ? 'Resetting…' : 'Set New Password'}
                    </button>
                </form>

                <p className="auth-switch">
                    Remembered your password? <span className="auth-switch-link" onClick={() => history.push('/login')}>Sign in</span>
                </p>
            </section>
        </main>
    );
}
