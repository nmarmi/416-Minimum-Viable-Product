import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../auth';
import MUIErrorModal from './MUIErrorModal';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';

export default function RegisterScreen() {
    const { auth } = useContext(AuthContext);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [newUserId, setNewUserId] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const password = formData.get('password');
        const result = await auth.registerUser(
            formData.get('userName'),
            formData.get('email'),
            password,
            password
        );
        if (result?.success) {
            setNewUserId(result.userId || null);
            setShowRoleModal(true);
        }
    };

    const handleRoleChoice = (role) => {
        setShowRoleModal(false);
        auth.setUserRole(role, newUserId);
    };

    return (
        <main className="login-screen">
            <section className="login-card register-card">
                <h1 className="login-brand">DraftIQ</h1>
                <div className="register-icon-wrap">
                    <PersonAddAltRoundedIcon sx={{ fontSize: 46, color: '#4f3d97' }} />
                </div>
                <h2 className="login-heading register-heading">Create an account</h2>
                <p className="register-subtitle">Enter your email to sign up for this app</p>

                <div className="auth-switch" role="tablist" aria-label="Authentication">
                    <Link className="auth-switch-item" to="/login">Login</Link>
                    <span className="auth-switch-item active">Register</span>
                </div>

                <form className="login-form register-form" noValidate onSubmit={handleSubmit}>
                    <label htmlFor="email" className="login-label">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required className="login-input" />

                    <label htmlFor="userName" className="login-label">Username</label>
                    <input id="userName" name="userName" type="text" autoComplete="username" required className="login-input" />

                    <label htmlFor="password" className="login-label">Password</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="login-input"
                    />

                    <p className="password-hint">Must be 8+ characters with at least one number</p>

                    <button className="login-submit-btn" type="submit">
                        Create
                    </button>
                </form>

                <p className="terms-copy register-terms">
                    By clicking Create, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>
                </p>
            </section>
            {showRoleModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card">
                        <h3>Choose your role</h3>
                        <p>Select where you want to start.</p>
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => handleRoleChoice("player")}>
                                Player
                            </button>
                            <button type="button" className="home-dark-btn" onClick={() => handleRoleChoice("commissioner")}>
                                Commissioner
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <MUIErrorModal />
        </main>
    );
}
