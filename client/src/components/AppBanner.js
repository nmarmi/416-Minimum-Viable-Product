import { useContext, useState } from 'react';
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
        {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}
        </>
    );
}
