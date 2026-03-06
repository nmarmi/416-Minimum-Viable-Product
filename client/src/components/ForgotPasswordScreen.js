import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

export default function ForgotPasswordScreen() {
    const handleSubmit = (event) => {
        event.preventDefault();
    };

    return (
        <main className="login-screen">
            <section className="login-card forgot-card">
                <h1 className="login-brand">DraftIQ</h1>
                <div className="forgot-icon-wrap">
                    <LockOutlinedIcon sx={{ fontSize: 46, color: '#232326' }} />
                </div>
                <h2 className="login-heading forgot-heading">Reset Password</h2>

                <form className="login-form forgot-form" noValidate onSubmit={handleSubmit}>
                    <label htmlFor="email" className="login-label">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className="login-input" />

                    <label htmlFor="newPassword" className="login-label">Enter New Password</label>
                    <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="login-input"
                    />

                    <label htmlFor="passwordConfirm" className="login-label">Re-enter Password</label>
                    <input
                        id="passwordConfirm"
                        name="passwordConfirm"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="login-input"
                    />

                    <button className="login-submit-btn" type="submit">
                        Reset
                    </button>
                </form>

                <p className="terms-copy forgot-terms">
                    By clicking Reset, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>
                </p>
            </section>
        </main>
    );
}
