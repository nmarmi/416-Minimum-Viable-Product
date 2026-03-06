import { useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../auth';
import MUIErrorModal from './MUIErrorModal';

export default function LoginScreen() {
    const { auth } = useContext(AuthContext);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await auth.loginUser(
            formData.get('email'),
            formData.get('password')
        );
    };

    return (
        <main className="login-screen">
            <section className="login-card">
                <h1 className="login-brand">DraftIQ</h1>
                <h3 className="login-heading">Log into your account</h3>

                <div className="auth-switch" role="tablist" aria-label="Authentication">
                    <span className="auth-switch-item active">Login</span>
                    <Link className="auth-switch-item" to="/register">Register</Link>
                </div>

                <form className="login-form" noValidate onSubmit={handleSubmit}>
                    <label htmlFor="email" className="login-label">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className="login-input" />

                    <label htmlFor="password" className="login-label">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="login-input"
                    />

                    <button className="forgot-password" type="button">
                        Forgot Password ?
                    </button>

                    <button className="login-submit-btn" type="submit">
                        Sign In
                    </button>
                </form>

                <p className="terms-copy">
                    By clicking Sign In, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>
                </p>
            </section>
            <MUIErrorModal />
        </main>
    );
}
