import { useContext, useEffect, useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import AuthContext from '../auth';
import AccountSettingsModal from './AccountSettingsModal';

export default function AppBanner() {
    const { auth } = useContext(AuthContext);
    const history = useHistory();
    const location = useLocation();
    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!toast) return undefined;
        const id = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(id);
    }, [toast]);

    useEffect(() => {
        if (!auth.loggedIn && showSettings) {
            setShowSettings(false);
            setToast({ type: 'error', message: 'Account deleted.' });
        }
    }, [auth.loggedIn, showSettings]);
    const inAuthRoute = (
        location.pathname === '/login' ||
        location.pathname === '/register'
    );

    const handleLogout = async () => {
        await auth.logoutUser();
    };

    return (
        <>
        <header className="app-banner">
            <button className="link-button brand" type="button" onClick={() => history.push('/')}>
                <span className="brand-mark">⌘</span>
                <span>DraftIQ</span>
            </button>
            <nav className="app-banner-nav">
                {auth.loggedIn ? (
                    <>
                        <button
                            className="avatar-pill avatar-pill-btn"
                            type="button"
                            onClick={() => setShowSettings(true)}
                            aria-label="account settings"
                            title="Account settings"
                        >
                            <PersonOutlineRoundedIcon sx={{ fontSize: 30 }} />
                        </button>
                        <button className="link-button logout-icon-btn" type="button" onClick={handleLogout} aria-label="logout">
                            <LogoutRoundedIcon sx={{ fontSize: 24 }} />
                        </button>

                    </>
                ) : (
                    <>
                        {inAuthRoute ? (
                            <>
                                <Link className="banner-auth-btn active-light" to="/login">
                                    Sign in
                                </Link>
                                <Link className="banner-auth-btn active-dark" to="/register">
                                    Register
                                </Link>
                            </>
                        ) : (
                            <Link className="banner-cta-btn" to="/register">Get Started</Link>
                        )}
                    </>
                )}
            </nav>
        </header>
        {showSettings && (
            <AccountSettingsModal
                onClose={() => setShowSettings(false)}
                onSuccess={(type, message) => setToast({ type, message })}
            />
        )}
        {toast && (
            <div className={`draft-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
                {toast.message}
            </div>
        )}
        </>
    );
}
