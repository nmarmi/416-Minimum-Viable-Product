import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import authRequestSender from '../auth/requests';

export default function ForgotPasswordScreen() {
    const history = useHistory();
    const [email,       setEmail]       = useState('');
    const [submitting,  setSubmitting]  = useState(false);
    const [errorMsg,    setErrorMsg]    = useState('');
    const [devToken,    setDevToken]    = useState(null); // returned in dev mode only

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) { setErrorMsg('Email is required.'); return; }

        setSubmitting(true);
        setErrorMsg('');
        const res = await authRequestSender.forgotPassword(email.trim());
        setSubmitting(false);

        if (res.status === 200 && res.data?.success) {
            if (res.data.token) {
                // Dev mode: server returned the raw token so we can use it immediately
                setDevToken(res.data.token);
            } else {
                // Production: tell the user to check their email
                history.push('/login?reset=requested');
            }
        } else {
            setErrorMsg(res.data?.errorMessage || 'Something went wrong. Please try again.');
        }
    };

    if (devToken) {
        return (
            <main className="login-screen">
                <section className="login-card forgot-card">
                    <h1 className="login-brand">DraftIQ</h1>
                    <h2 className="login-heading forgot-heading">Token Issued</h2>
                    <p className="forgot-dev-note">
                        Dev mode — no email was sent. Copy this token and use it on the reset-password screen:
                    </p>
                    <code className="forgot-dev-token">{devToken}</code>
                    <button
                        className="login-submit-btn"
                        type="button"
                        onClick={() => history.push(`/reset-password?token=${devToken}`)}
                    >
                        Continue to Reset Password →
                    </button>
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
                <h2 className="login-heading forgot-heading">Forgot Password</h2>
                <p className="forgot-subtitle">Enter your email and we'll send a reset link.</p>

                <form className="login-form forgot-form" noValidate onSubmit={handleSubmit}>
                    <label htmlFor="email" className="login-label">Email</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    {errorMsg && <p className="login-error">{errorMsg}</p>}

                    <button className="login-submit-btn" type="submit" disabled={submitting}>
                        {submitting ? 'Sending…' : 'Send Reset Link'}
                    </button>
                </form>

                <p className="auth-switch">
                    Remember your password? <span className="auth-switch-link" onClick={() => history.push('/login')}>Sign in</span>
                </p>
            </section>
        </main>
    );
}
